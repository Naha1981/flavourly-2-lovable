import { db } from "./db.server";
import { enqueueOutbox } from "./outbox.server";
import { sastMonthDay } from "./whatsapp/quiet-hours";

/** Queues one birthday greeting per guest per year. The outbox enforces the send window. */
export async function runDailyMilestones(now: Date = new Date()) {
  const c = await db();
  const { data: guests, error } = await c
    .from("customers")
    .select("id, tenant_id, phone, name, is_vip")
    .eq("birthday", sastMonthDay(now));
  if (error) throw error;

  const { data: venues } = await c
    .from("tenant_profiles")
    .select("tenant_id, name, auto_replies_enabled");
  const venueByTenant = new Map((venues ?? []).map((v) => [v.tenant_id as string, v]));
  const year = now.getUTCFullYear();

  let queued = 0;
  for (const g of guests ?? []) {
    const venue = venueByTenant.get(g.tenant_id as string);
    if (!venue?.auto_replies_enabled) continue;
    const first = ((g.name as string | null) ?? "").split(" ")[0] || "there";
    const text = `Happy birthday, ${first}! 🎂 Everyone at ${venue.name} is thinking of you. Reply here whenever you'd like to book a table to celebrate.`;
    const r = await enqueueOutbox({
      tenantId: g.tenant_id as string,
      phone: g.phone as string,
      text,
      automated: true,
      dedupeKey: `birthday:${g.id}:${year}`,
    });
    if (r.queued) queued += 1;
  }
  return { candidates: guests?.length ?? 0, queued };
}
