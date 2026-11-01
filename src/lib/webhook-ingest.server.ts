/** Only signed, mapped inbox deliveries may reach this module. Never trust tenant hints. */
import { db } from "./db.server";
export function splitEvents(parsed: unknown): unknown[] {
  return [parsed];
}
export function tenantOf(_parsed: unknown): null {
  return null;
}
export type IngestResult = { events: number; saved: number; failures: string[]; tenantId?: string };
export function parseInboxEvent(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  // Provider JSON is validated below before use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as Record<string, any>;
  if (r["event"] !== "message.received") return null;
  const m = r["message"] ?? {};
  const a = m.account ?? r["account"] ?? {};
  if (
    a.platform !== "whatsapp" ||
    m.fromMe ||
    (m.direction && !["incoming", "inbound"].includes(m.direction))
  )
    return null;
  const sender = typeof m.sender === "object" ? m.sender : { id: m.sender };
  const phone =
    String(sender?.phoneNumber ?? sender?.id ?? "")
      .split("@")[0]
      ?.replace(/\D/g, "") ?? "";
  const accountId = a.accountId ?? a.id ?? a._id;
  const conversationId =
    r["conversation"]?.id ?? r["conversation"]?.conversationId ?? m.conversationId;
  const messageId = m.id ?? m._id;
  const text = m.text ?? m.body;
  const timestamp = Date.parse(r["timestamp"] ?? "");
  if (
    !r["id"] ||
    !accountId ||
    !a.profileId ||
    !conversationId ||
    !messageId ||
    typeof text !== "string" ||
    !text.trim() ||
    !/^\d{9,15}$/.test(phone) ||
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() + 300000
  )
    return null;
  return {
    eventId: String(r["id"]),
    accountId: String(accountId),
    profileId: String(a.profileId),
    conversationId: String(conversationId),
    messageId: String(messageId),
    phone,
    name: typeof sender?.name === "string" ? sender.name : null,
    body: text.trim().slice(0, 4000),
    sentAt: new Date(timestamp).toISOString(),
  };
}
export async function ingestPayload(parsed: unknown): Promise<IngestResult> {
  const m = parseInboxEvent(parsed);
  if (!m) return { events: 1, saved: 0, failures: [] };
  const c = await db();
  const { data: mapping, error } = await c
    .from("wa_channels")
    .select("tenant_id")
    .eq("account_id", m.accountId)
    .eq("profile_id", m.profileId)
    .maybeSingle();
  if (error) return { events: 1, saved: 0, failures: ["Account lookup failed"] };
  if (!mapping) return { events: 1, saved: 0, failures: [] };
  const result = await c.rpc("wa_ingest_inbox", {
    p_tenant: mapping.tenant_id,
    p_event: m.eventId,
    p_message: m.messageId,
    p_conversation: m.conversationId,
    p_phone: m.phone,
    p_name: m.name,
    p_body: m.body,
    p_sent: m.sentAt,
  });
  if (result.error) return { events: 1, saved: 0, failures: ["Inbox could not be saved"] };
  if (!result.data) return { events: 1, saved: 0, failures: [] };
  const conversationId = String(result.data);
  const { optOutKeyword, recordOptOut, recordOptIn } = await import("./opt-out.server");
  const keyword = optOutKeyword(m.body);
  if (keyword === "stop") {
    await recordOptOut(mapping.tenant_id, m.phone);
    await c
      .from("wa_conversations")
      .update({ status: "resolved" })
      .eq("tenant_id", mapping.tenant_id)
      .eq("id", conversationId);
  } else if (keyword === "start") await recordOptIn(mapping.tenant_id, m.phone);
  else if (Date.now() - Date.parse(m.sentAt) < 86400000) {
    try {
      const { autoReply } = await import("./auto-reply.server");
      await autoReply({
        tenantId: mapping.tenant_id,
        phone: m.phone,
        name: m.name,
        text: m.body,
        conversationId,
        waAccountId: m.accountId,
        waMessageId: m.messageId,
      });
    } catch {
      await c
        .from("wa_conversations")
        .update({
          status: "needs_approval",
          next_action: "Reply could not be prepared. A team member needs to take over.",
        })
        .eq("tenant_id", mapping.tenant_id)
        .eq("id", conversationId);
    }
  }
  return { events: 1, saved: 1, failures: [], tenantId: mapping.tenant_id };
}
