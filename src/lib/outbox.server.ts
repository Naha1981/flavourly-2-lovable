import { db } from "./db.server";
import { sendWhatsApp } from "./wa-account.server";
import { isWithinSendWindow, nextSendWindowStart } from "./whatsapp/quiet-hours";
import { decideApproval } from "./approval-classifier";

const MAX_ATTEMPTS = 3;
const RETRY_MS = 10 * 60 * 1000;

export async function enqueueOutbox(input: {
  tenantId: string;
  phone: string;
  text: string;
  automated: boolean;
  dedupeKey?: string;
  scheduledFor?: Date;
  campaignId?: string;
  variant?: "a" | "b";
  conversationId?: string;
}) {
  const c = await db();
  const base = input.scheduledFor ?? new Date();
  const when = input.automated ? nextSendWindowStart(base) : base;
  const decision = input.automated ? decideApproval(input.text) : { outcome: "auto_send" as const, riskLevel: "green" as const };

  let status = input.automated && when !== base ? "quiet_hours_delayed" : "pending";
  if (decision.outcome === "require_approval") status = "approval_required";

  const { data: job, error } = await c.from("outbox_jobs").insert({
    tenant_id: input.tenantId,
    recipient_phone: input.phone.replace(/\D/g, ""),
    message_text: input.text,
    automated: input.automated,
    dedupe_key: input.dedupeKey ?? null,
    scheduled_for: when.toISOString(),
    status,
    campaign_id: input.campaignId ?? null,
    variant: input.variant ?? null,
    conversation_id: input.conversationId ?? null,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return { queued: false, approvalRequired: false, duplicate: true } as const;
    throw error;
  }

  if (decision.outcome === "require_approval") {
    const { createApprovalRequest } = await import("./approval.server");
    const request = await createApprovalRequest({
      tenantId: input.tenantId,
      outboxJobId: job.id,
      recipientPhone: input.phone.replace(/\D/g, ""),
      messageText: input.text,
      riskLevel: decision.riskLevel,
      reason: decision.reason,
    });
    return { queued: false, approvalRequired: true, approvalRequestId: request.id } as const;
  }

  return { queued: true, approvalRequired: false } as const;
}

export async function processOutbox(limit = 50) {
  const c = await db();
  const now = new Date();
  const { data: due, error } = await c
    .from("outbox_jobs")
    .select("id, tenant_id, recipient_phone, message_text, automated, attempts, status, conversation_id, campaign_id")
    .in("status", ["pending", "quiet_hours_delayed"])
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const stats = { sent: 0, delayed: 0, retried: 0, failed: 0, skipped: 0 };
  for (const job of due ?? []) {
    if (job.automated && !isWithinSendWindow(now)) {
      await c.from("outbox_jobs").update({
        status: "quiet_hours_delayed",
        scheduled_for: nextSendWindowStart(now).toISOString(),
      }).eq("id", job.id);
      stats.delayed += 1;
      continue;
    }

    const { data: claimed } = await c.from("outbox_jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .in("status", ["pending", "quiet_hours_delayed"])
      .select("id")
      .maybeSingle();
    if (!claimed) {
      stats.skipped += 1;
      continue;
    }

    if (job.automated) {
      const { isOptedOut } = await import("./opt-out.server");
      if (await isOptedOut(job.tenant_id as string, job.recipient_phone as string)) {
        await c.from("outbox_jobs").update({ status: "opted_out", error: null }).eq("id", job.id);
        stats.skipped += 1;
        continue;
      }
    }

    const res = await sendWhatsApp(job.tenant_id, job.recipient_phone, job.message_text);
    if (res.ok) {
      await c.from("outbox_jobs").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", job.id);
      if (job.campaign_id) {
        await c.from("campaigns").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("tenant_id", job.tenant_id).eq("id", job.campaign_id).eq("status", "queued");
      }

      if (job.conversation_id) {
        const sentAt = new Date().toISOString();
        await c.from("wa_messages").insert({
          conversation_id: job.conversation_id,
          tenant_id: job.tenant_id,
          wa_message_id: res.data.messageId ?? null,
          direction: "out",
          body: job.message_text,
          sent_at: sentAt,
        });
        await c.from("wa_conversations").update({
          last_message: job.message_text.slice(0, 400),
          last_message_at: sentAt,
        }).eq("tenant_id", job.tenant_id).eq("id", job.conversation_id);
      }
      stats.sent += 1;
    } else if ("waking" in res && res.waking) {
      // Operator cold start: not a real attempt. Retry shortly without burning one.
      await c.from("outbox_jobs").update({
        status: "pending",
        error: res.error,
        scheduled_for: new Date(Date.now() + RETRY_MS).toISOString(),
      }).eq("id", job.id);
      stats.retried += 1;
    } else if (job.attempts + 1 >= MAX_ATTEMPTS) {
      await c.from("outbox_jobs").update({ status: "failed", attempts: job.attempts + 1, error: res.error }).eq("id", job.id);
      stats.failed += 1;
    } else {
      await c.from("outbox_jobs").update({
        status: "pending",
        attempts: job.attempts + 1,
        error: res.error,
        scheduled_for: new Date(Date.now() + RETRY_MS).toISOString(),
      }).eq("id", job.id);
      stats.retried += 1;
    }
  }
  return stats;
}
