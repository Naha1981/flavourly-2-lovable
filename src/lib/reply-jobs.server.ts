import { db } from "./db.server";
import { autoReply } from "./auto-reply.server";

type ReplyJob = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  message_id: string;
  account_id: string;
  phone: string;
  guest_name: string | null;
  body: string;
  inbound_at: string;
  claim_token: string;
};

/** Accepted jobs only reconcile audit. Never call the provider again. */
export async function reconcileReplyJobs() {
  const c = await db();
  const rows = await c.from("wa_reply_jobs").select("id").eq("state", "accepted").limit(10);
  if (rows.error) throw new Error("Reply queue unavailable");
  for (const row of rows.data ?? []) {
    const result = await c.rpc("wa_reconcile_reply", { p_job: row.id });
    if (result.error) console.error("reply audit reconciliation pending", row.id);
  }
}

export async function processReplyJobs(limit = 2) {
  if (process.env["WHATSAPP_SEND_ENABLED"] !== "true") return { processed: 0, paused: true };
  const c = await db();
  await reconcileReplyJobs();
  let processed = 0;
  for (let i = 0; i < Math.min(limit, 2); i++) {
    const claimed = await c.rpc("wa_claim_reply");
    if (claimed.error) throw new Error("Reply queue claim failed");
    const j = claimed.data?.[0] as ReplyJob | undefined;
    if (!j) break;
    processed++;
    const hold = async (reason: string) => {
      // Do not overwrite an accepted result if audit reconciliation fails.
      await c
        .from("wa_reply_jobs")
        .update({
          state: "held",
          error: reason.slice(0, 400),
          updated_at: new Date().toISOString(),
        })
        .eq("id", j.id)
        .eq("claim_token", j.claim_token)
        .in("state", ["preparing", "sending"]);
      await c
        .from("wa_conversations")
        .update({ status: "needs_approval", next_action: reason.slice(0, 400) })
        .eq("id", j.conversation_id)
        .eq("tenant_id", j.tenant_id);
    };
    try {
      if (
        !Number.isFinite(Date.parse(j.inbound_at)) ||
        Date.now() - Date.parse(j.inbound_at) >= 86400000
      ) {
        await hold("Original enquiry is over 24 hours old. No reply sent.");
        continue;
      }
      const { flagReviewFeedback } = await import("./review-requests.server");
      if (await flagReviewFeedback(j.tenant_id, j.phone, j.body, j.conversation_id)) {
        await hold("Feedback needs a team member.");
        continue;
      }
      const result = await autoReply({
        tenantId: j.tenant_id,
        phone: j.phone,
        name: j.guest_name,
        text: j.body,
        conversationId: j.conversation_id,
        waAccountId: j.account_id,
        waMessageId: j.message_id,
        durable: {
          beforeSend: async (text) => {
            const marked = await c.rpc("wa_begin_reply_send", {
              p_job: j.id,
              p_claim: j.claim_token,
              p_text: text,
            });
            if (marked.error) throw new Error("Could not save send intent. No provider call made.");
            return marked.data === true;
          },
          accepted: async (messageId) => {
            const saved = await c.rpc("wa_accept_reply", {
              p_job: j.id,
              p_claim: j.claim_token,
              p_provider: messageId,
            });
            if (saved.error || saved.data !== true)
              throw new Error("Reply acceptance audit uncertain. Check provider; do not resend.");
          },
        },
      });
      if (!result.replied)
        await hold("Reply paused by consent, handoff or activation checks. Team review needed.");
    } catch (error) {
      await hold(
        error instanceof Error
          ? error.message
          : "Reply interrupted. Check provider before any retry.",
      );
    }
  }
  await reconcileReplyJobs();
  return { processed, paused: false };
}
