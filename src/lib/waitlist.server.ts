import { db } from "./db.server";
import { prettyWhen } from "./booking/parse";
import { enqueueOutbox } from "./outbox.server";

const OFFER_TTL_MINUTES = 20;

/**
 * A reservation was just cancelled. Offer its slot to the longest-waiting
 * guest whose party fits, with a 20-minute reply window. Safe to call from
 * more than one place (webhook, dashboard) at once: the DB function locks the row.
 */
export async function offerFreedSlot(
  tenantId: string,
  reservation: {
    id: string;
    party_size: number;
    reservation_date: string;
    reservation_time: string;
  },
) {
  const c = await db();
  const { data: offer, error } = await c
    .rpc("claim_waitlist_offer", {
      p_tenant: tenantId,
      p_date: reservation.reservation_date,
      p_party_size: reservation.party_size,
      p_reservation_id: reservation.id,
      p_ttl_minutes: OFFER_TTL_MINUTES,
    })
    .single();
  if (error || !offer) return null;
  const o = offer as {
    id: string;
    customer_phone: string;
    customer_name: string | null;
    party_size: number;
  };

  const { data: venue } = await c
    .from("tenant_profiles")
    .select("name")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const time = reservation.reservation_time.slice(0, 5);
  const first = (o.customer_name ?? "").split(" ")[0] || "there";
  const text = `Hi ${first}, a table just opened up at ${venue?.name ?? "the restaurant"} for ${o.party_size}, ${prettyWhen(reservation.reservation_date, time)}. Reply *YES* within ${OFFER_TTL_MINUTES} minutes to take it.`;

  // A live, time-boxed offer, not marketing: sent right away regardless of the send window.
  await enqueueOutbox({
    tenantId,
    phone: o.customer_phone,
    text,
    automated: false,
    dedupeKey: `waitlist-offer:${o.id}`,
  });
  return o;
}

/** Handles YES/CANCEL to a pending waitlist offer. Returns the reply, or null if this isn't one. */
export async function handleWaitlistReply(input: {
  tenantId: string;
  phone: string;
  text: string;
  now?: Date;
}): Promise<string | null> {
  const t = input.text
    .trim()
    .toLowerCase()
    .replace(/[.!\s]+$/g, "");
  const yes = /^(yes|yep|yeah|confirm|confirmed|i'?ll take it|ill take it)$/.test(t);
  const cancel = /^(cancel|no|no thanks)$/.test(t);
  if (!yes && !cancel) return null;

  const now = input.now ?? new Date();
  const c = await db();
  const phone = input.phone.replace(/\D/g, "");
  const { data: entry } = await c
    .from("waitlist_entries")
    .select("id, offer_reservation_id, offer_expires_at, party_size, requested_date")
    .eq("tenant_id", input.tenantId)
    .eq("customer_phone", phone)
    .eq("status", "offered")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!entry) return null;

  if (new Date(entry.offer_expires_at as string) <= now) {
    await c
      .from("waitlist_entries")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("id", entry.id);
    return null; // let a fresh "yes" fall through to a new booking instead of a stale offer
  }

  if (cancel) {
    await c
      .from("waitlist_entries")
      .update({ status: "cancelled", updated_at: now.toISOString() })
      .eq("id", entry.id);
    return "No problem, we'll keep your spot on the list for another opening.";
  }

  // Claim it, but only if it's still ours to claim (guards a race with the 20-min sweep below).
  const { data: won } = await c
    .from("waitlist_entries")
    .update({ status: "booked", updated_at: now.toISOString() })
    .eq("id", entry.id)
    .eq("status", "offered")
    .select("id");
  if (!won?.length)
    return "Sorry, that offer just expired. Reply anytime to join the waitlist again.";

  await c
    .from("reservations")
    .update({ status: "confirmed", customer_confirmed_at: now.toISOString() })
    .eq("id", entry.offer_reservation_id)
    .eq("status", "cancelled"); // only if nobody else has since taken this slot
  return `You're booked, ${prettyWhen(entry.requested_date as string, "").replace(/ at $/, "")}. See you then!`;
}

/** Expired offers roll to the next person in line. Run on the reminders/outbox schedule. */
export async function sweepExpiredOffers(now: Date = new Date()) {
  const c = await db();
  const { data: expired } = await c
    .from("waitlist_entries")
    .select("id, tenant_id, offer_reservation_id")
    .eq("status", "offered")
    .lt("offer_expires_at", now.toISOString());

  let rerolled = 0;
  for (const w of expired ?? []) {
    await c
      .from("waitlist_entries")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("id", w.id);
    const { data: r } = await c
      .from("reservations")
      .select("id, party_size, reservation_date, reservation_time, status")
      .eq("id", w.offer_reservation_id)
      .maybeSingle();
    if (r?.status === "cancelled") {
      const next = await offerFreedSlot(w.tenant_id as string, r as never);
      if (next) rerolled += 1;
    }
  }
  return { expired: expired?.length ?? 0, rerolled };
}
