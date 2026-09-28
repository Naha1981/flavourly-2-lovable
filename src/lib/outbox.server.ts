import { db } from "./db.server";
import { sendWhatsApp } from "./wa-account.server";
import { isWithinSendWindow, nextSendWindowStart } from "./whatsapp/quiet-hours";

const MAX_ATTEMPTS = 3;
const RETRY_MS = 10 * 60 * 1000;

/**
 * Queue an outbound message. Automated messages are scheduled inside the
 * 07:00–20:00 SAST window up front, and the worker re-checks at send time.
 * `dedupeKey` makes enqueueing idempotent (e.g. one birthday message per year).
 */
export async function enqueueOutbox(input: {
  tenantId: string;
  phone: string;
  text: string;
  automated: boolean;
  dedupeKey?: string;
  scheduledFor?: Date;
}) {
  const c = await db();
  const base = input.scheduledFor ?? new Date();
  const when = input.automated ? nextSendWindowStart(base) : base;
  const { error } = await c.from("outbox_jobs").insert({
    tenant_id: input.tenantId,
    recipient_phone: input.phone.replace(/\D/g, ""),
    message_text: input.text,
    automated: input.automated,
    dedupe_key: input.dedupeKey ?? null,
    scheduled_for: when.toISOString(),
    status: input.automated && when !== base ? "quiet_hours_delayed" : "pending",
  });
  if (error && error.code !== "23505") throw error; // 23505 = already queued
  return { queued: !error };
}

export async function processOutbox(limit = 50) {
  const c = await db();
  const now = new Date();
  const { data: due, error } = await c
    .from("outbox_jobs")
    .select("id, tenant_id, recipient_phone, message_text, automated, attempts, status")
    .in("status", ["pending", "quiet_hours_delayed"])
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const stats = { sent: 0, delayed: 0, retried: 0, failed: 0, skipped: 0 };
  for (const job of due ?? []) {
    if (job.automated && !isWithinSendWindow(now)) {
      await c
        .from("outbox_jobs")
        .update({
          status: "quiet_hours_delayed",
          scheduled_for: nextSendWindowStart(now).toISOString(),
        })
        .eq("id", job.id);
      stats.delayed += 1;
      continue;
    }

    // Claim the job; if another worker got there first the update returns no row.
    const { data: claimed } = await c
      .from("outbox_jobs")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id)
      .in("status", ["pending", "quiet_hours_delayed"])
      .select("id")
      .maybeSingle();
    if (!claimed) {
      stats.skipped += 1;
      continue;
    }

    const res = await sendWhatsApp(job.tenant_id, job.recipient_phone, job.message_text);
    if (res.ok) {
      await c
        .from("outbox_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", job.id);
      stats.sent += 1;
    } else if (job.attempts + 1 >= MAX_ATTEMPTS) {
      await c.from("outbox_jobs").update({ status: "failed", error: res.error }).eq("id", job.id);
      stats.failed += 1;
    } else {
      await c
        .from("outbox_jobs")
        .update({
          status: "pending",
          error: res.error,
          scheduled_for: new Date(Date.now() + RETRY_MS).toISOString(),
        })
        .eq("id", job.id);
      stats.retried += 1;
    }
  }
  return stats;
}
