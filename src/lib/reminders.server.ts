import { db } from "./db.server";
import { dueTier, reminderText, reservationStart } from "./booking/reminders";
import { prettyWhen } from "./booking/parse";
import { enqueueOutbox } from "./outbox.server";
import { sastDateString } from "./whatsapp/quiet-hours";

/** Run every ~15 minutes. Idempotent: each (reservation, tier) is queued once via dedupe_key. */
export async function runReminders(now: Date = new Date()) {
  const c = await db();
  const from = sastDateString(now);
  const to = sastDateString(new Date(now.getTime() + 3 * 86_400_000));
  const { data: rows, error } = await c
    .from("reservations")
    .select(
      "id, tenant_id, customer_phone, customer_name, party_size, reservation_date, reservation_time, created_at",
    )
    .eq("status", "confirmed")
    .is("attendance_confirmed_at", null)
    .gte("reservation_date", from)
    .lte("reservation_date", to);
  if (error) throw error;

  const { data: venues } = await c
    .from("tenant_profiles")
    .select("tenant_id, name, auto_replies_enabled");
  const venueBy = new Map((venues ?? []).map((v) => [v.tenant_id as string, v]));

  let queued = 0;
  for (const r of rows ?? []) {
    const venue = venueBy.get(r.tenant_id as string);
    if (!venue?.auto_replies_enabled) continue;
    const time = (r.reservation_time as string).slice(0, 5);
    const tier = dueTier(
      reservationStart(r.reservation_date as string, time),
      new Date(r.created_at as string),
      now,
    );
    if (!tier) continue;
    const res = await enqueueOutbox({
      tenantId: r.tenant_id as string,
      phone: r.customer_phone as string,
      text: reminderText(
        tier,
        r.customer_name as string,
        venue.name as string,
        prettyWhen(r.reservation_date as string, time),
        r.party_size as number,
      ),
      automated: true,
      dedupeKey: `reminder:${r.id}:${tier}h`,
    });
    if (res.queued) queued += 1;
  }
  return { candidates: rows?.length ?? 0, queued };
}

/**
 * Handles YES / CANCEL replies, but only for guests we reminded in the last 48h,
 * so a stray "yes" elsewhere is never read as an attendance confirmation.
 */
export async function handleReminderReply(input: {
  tenantId: string;
  phone: string;
  text: string;
  now?: Date;
}): Promise<string | null> {
  const t = input.text
    .trim()
    .toLowerCase()
    .replace(/[.!\s]+$/g, "");
  const yes = /^(yes|yep|yeah|confirm|confirmed|see you there|coming)$/.test(t);
  const cancel = /^(cancel|no|can'?t make it|cannot make it)$/.test(t);
  if (!yes && !cancel) return null;

  const now = input.now ?? new Date();
  const c = await db();
  const phone = input.phone.replace(/\D/g, "");
  const { data: recent } = await c
    .from("outbox_jobs")
    .select("dedupe_key")
    .eq("tenant_id", input.tenantId)
    .eq("recipient_phone", phone)
    .like("dedupe_key", "reminder:%")
    .eq("status", "sent")
    .gt("sent_at", new Date(now.getTime() - 48 * 3_600_000).toISOString())
    .order("sent_at", { ascending: false })
    .limit(1);
  const reservationId = recent?.[0]?.dedupe_key?.split(":")[1];
  if (!reservationId) return null;

  const { data: r } = await c
    .from("reservations")
    .select("id, status, reservation_date, reservation_time, customer_name")
    .eq("tenant_id", input.tenantId)
    .eq("id", reservationId)
    .maybeSingle();
  if (!r || r.status !== "confirmed") return null;
  if (
    reservationStart(r.reservation_date as string, (r.reservation_time as string).slice(0, 5)) <=
    now
  )
    return null;

  const when = prettyWhen(r.reservation_date as string, (r.reservation_time as string).slice(0, 5));
  if (yes) {
    await c
      .from("reservations")
      .update({ attendance_confirmed_at: now.toISOString() })
      .eq("id", r.id);
    return `Thank you, you're confirmed for ${when}. See you then!`;
  }
  await c.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
  return `No problem, I've cancelled your booking for ${when}. We hope to see you another time.`;
}
