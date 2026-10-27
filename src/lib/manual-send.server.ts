import { db } from "./db.server";
import { sendWhatsApp } from "./wa-account.server";

const digits = (phone: string) => phone.replace(/\D/g, "");

export type ManualSendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

/**
 * A person at the restaurant replies to a guest from the dashboard.
 *
 * Unlike a raw operator call this goes through the same gates as every other
 * outbound message: trial/subscription/quota limits (assertCanSendNow), the
 * restaurant's OWN WhatsApp account (never one named by the browser), and it is
 * recorded in the inbox. The recipient must already have written to this
 * restaurant, so the box cannot be used to cold-message arbitrary numbers.
 *
 * Opt-out is deliberately not checked: a reply to a guest who is talking to the
 * restaurant is transactional (see opt-out.server.ts); automated and bulk
 * sends still go through the outbox, which does check it.
 */
export async function sendManualReply(tenantId: string, to: string, text: string): Promise<ManualSendResult> {
  const phone = digits(to);
  const c = await db();

  const { data: conversation } = await c
    .from("wa_conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("guest_phone", [phone, "+" + phone])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return {
      ok: false,
      error: "This guest hasn't messaged the restaurant on WhatsApp, so a manual reply can't be sent. Use a campaign instead.",
    };
  }

  let sent;
  try {
    sent = await sendWhatsApp(tenantId, phone, text); // no account hint: resolved from the tenant's own profile
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Message could not be sent." };
  }
  if (!sent.ok) return { ok: false, error: sent.error };

  const now = new Date().toISOString();
  const messageId = sent.data.messageId ?? null;
  await c.from("wa_messages").insert({
    conversation_id: conversation.id,
    tenant_id: tenantId,
    wa_message_id: messageId,
    direction: "out",
    body: text,
    sent_at: now,
  });
  await c
    .from("wa_conversations")
    .update({ last_message: text.slice(0, 400), last_message_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", conversation.id);
  return { ok: true, messageId };
}
