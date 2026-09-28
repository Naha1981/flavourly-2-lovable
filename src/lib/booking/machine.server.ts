import { db, APP_URL } from "../db.server";
import { sastDateString } from "../whatsapp/quiet-hours";
import { hasBookingSignal, parseBookingText, prettyDay, prettyWhen } from "./parse";

const TTL_MS = 30 * 60 * 1000;
const MAX_AUTO_PARTY = 12;

type Draft = {
  id: string;
  status: "collecting" | "awaiting_confirmation";
  party_size: number | null;
  booking_date: string | null;
  booking_time: string | null;
  customer_name: string | null;
};

export type BookingResult = { handled: boolean; reply?: string };

const looksLikeName = (t: string) =>
  /^[A-Za-z][A-Za-z'-]{1,20}(\s+[A-Za-z][A-Za-z'-]{0,20}){0,2}$/.test(t.trim());

/** SAST "HH:mm" right now, to reject times that already passed today. */
function sastClock(now: Date) {
  return new Date(now.getTime() + 2 * 3600_000).toISOString().slice(11, 16);
}

/**
 * Multi-message booking conversation with a rolling 30-minute TTL. Deterministic:
 * every field is parsed by rules, and anything missing is asked for explicitly.
 * Returns handled:false to let the message fall through to a human / AI drafter.
 */
export async function handleBookingMessage(input: {
  tenantId: string;
  phone: string;
  guestName?: string | null;
  text: string;
  now?: Date;
}): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const c = await db();
  const intent = parseBookingText(input.text, now);

  const { data: rows } = await c
    .from("booking_drafts")
    .select("id, status, party_size, booking_date, booking_time, customer_name")
    .eq("tenant_id", input.tenantId)
    .eq("customer_phone", input.phone)
    .in("status", ["collecting", "awaiting_confirmation"])
    .gt("expires_at", now.toISOString())
    .order("updated_at", { ascending: false })
    .limit(1);
  const draft = (rows?.[0] as Draft | undefined) ?? null;

  if (!draft && !hasBookingSignal(intent, input.text)) return { handled: false };
  if (!draft && (intent.isConfirm || intent.isCancel)) return { handled: false };

  if (intent.isCancel && draft) {
    await c
      .from("booking_drafts")
      .update({ status: "abandoned", updated_at: now.toISOString() })
      .eq("id", draft.id);
    return {
      handled: true,
      reply: "No problem, I've cancelled that. Message us any time to book again.",
    };
  }

  if (intent.isConfirm && draft?.status === "awaiting_confirmation") {
    return finalize(input.tenantId, input.phone, draft, now);
  }

  // Merge new details into the draft. A bare answer fills whatever we last asked for.
  const bare = input.text.trim();
  let party = intent.partySize ?? draft?.party_size ?? undefined;
  let name = intent.name ?? draft?.customer_name ?? undefined;
  if (draft && !draft.party_size && party === undefined && /^\d{1,2}$/.test(bare))
    party = Number(bare);
  const date = intent.date ?? draft?.booking_date ?? undefined;
  const time = intent.time ?? draft?.booking_time ?? undefined;
  if (draft && date && time && party && !name && looksLikeName(bare) && !intent.isConfirm)
    name = bare.replace(/\b\w/g, (m) => m.toUpperCase());
  if (!name && input.guestName && looksLikeName(input.guestName)) name = input.guestName;

  if (party && party > MAX_AUTO_PARTY) {
    return { handled: false }; // large groups need a person
  }
  if (date && date < sastDateString(now)) {
    await save(c, draft, input, { party, name, date: undefined, time }, now, "collecting");
    return { handled: true, reply: "That date has already passed. Which date would you like?" };
  }
  if (date && time && date === sastDateString(now) && time <= sastClock(now)) {
    await save(c, draft, input, { party, name, date, time: undefined }, now, "collecting");
    return {
      handled: true,
      reply: "That time has already passed today. What time would suit you instead?",
    };
  }

  const complete = Boolean(party && date && time && name);
  await save(
    c,
    draft,
    input,
    { party, name, date, time },
    now,
    complete ? "awaiting_confirmation" : "collecting",
  );

  if (!party)
    return { handled: true, reply: "Happy to help with a table. How many guests will there be?" };
  if (!date)
    return {
      handled: true,
      reply: `A table for ${party}. Which date would you like? (e.g. tomorrow, Friday, 2 Oct)`,
    };
  if (!time) return { handled: true, reply: `And what time on ${prettyDay(date)}?` };
  if (!name) return { handled: true, reply: "What name should I put the booking under?" };

  return {
    handled: true,
    reply: `Here's what I have:\n\n*${name}*, table for *${party}*\n*${prettyWhen(date, time)}*\n\nReply *YES* to confirm, or tell me what to change.`,
  };
}

async function save(
  c: Awaited<ReturnType<typeof db>>,
  draft: Draft | null,
  input: { tenantId: string; phone: string },
  f: {
    party?: number | undefined;
    name?: string | undefined;
    date?: string | undefined;
    time?: string | undefined;
  },
  now: Date,
  status: "collecting" | "awaiting_confirmation",
) {
  const values = {
    party_size: f.party ?? null,
    customer_name: f.name ?? null,
    booking_date: f.date ?? null,
    booking_time: f.time ?? null,
    status,
    expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
    updated_at: now.toISOString(),
  };
  if (draft) {
    await c.from("booking_drafts").update(values).eq("id", draft.id);
  } else {
    await c
      .from("booking_drafts")
      .insert({ tenant_id: input.tenantId, customer_phone: input.phone, ...values });
  }
}

async function finalize(
  tenantId: string,
  phone: string,
  draft: Draft,
  now: Date,
): Promise<BookingResult> {
  const c = await db();
  if (!draft.party_size || !draft.booking_date || !draft.booking_time || !draft.customer_name) {
    return {
      handled: true,
      reply: "I'm missing a detail. Could you resend the date, time and party size?",
    };
  }
  const { error } = await c.from("reservations").insert({
    tenant_id: tenantId,
    customer_phone: phone,
    customer_name: draft.customer_name,
    party_size: draft.party_size,
    reservation_date: draft.booking_date,
    reservation_time: draft.booking_time,
    customer_confirmed_at: now.toISOString(),
    source_draft_id: draft.id, // unique: a double "YES" can't create two reservations
  });
  if (error && error.code !== "23505") throw error;
  await c
    .from("booking_drafts")
    .update({ status: "confirmed", updated_at: now.toISOString() })
    .eq("id", draft.id);

  const menu = APP_URL() ? `\n\nMenu: ${APP_URL()}/m/${tenantId}` : "";
  return {
    handled: true,
    reply: `*Booking received* ✅\n\n*${draft.customer_name}*, table for *${draft.party_size}*\n*${prettyWhen(draft.booking_date, draft.booking_time.slice(0, 5))}*\n\nWe'll message you if anything needs to change.${menu}`,
  };
}
