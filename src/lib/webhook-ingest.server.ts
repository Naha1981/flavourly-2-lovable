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
  if (r["test"] === true || r["event"] !== "message.received") return null;
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
    standby: m.metadata?.standby === true,
  };
}
export async function ingestPayload(parsed: unknown): Promise<IngestResult> {
  const statusResult = await ingestDeliveryStatus(parsed);
  if (statusResult) return statusResult;
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
    p_standby: m.standby,
  });
  if (result.error) return { events: 1, saved: 0, failures: ["Inbox could not be saved"] };
  if (!result.data) return { events: 1, saved: 0, failures: [] };
  // The RPC saved the inbound and reply job atomically. Drafting/sending belongs
  // to the existing cron worker, never the provider's short-lived HTTP request.
  return { events: 1, saved: 1, failures: [], tenantId: mapping.tenant_id };
}

/** Delivery receipts are status evidence, never an instruction to retry or send. */
async function ingestDeliveryStatus(raw: unknown): Promise<IngestResult | null> {
  if (!raw || typeof raw !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as Record<string, any>;
  const status = (
    {
      "message.sent": "sent",
      "message.delivered": "delivered",
      "message.read": "read",
      "message.failed": "failed",
    } as Record<string, string>
  )[r["event"]];
  if (!status) return null;
  if (r["test"] === true) return { events: 1, saved: 0, failures: [] };
  const account = r["account"] ?? {};
  const message = r["message"] ?? {};
  const at = Date.parse(r["statusAt"] ?? r["timestamp"] ?? "");
  if (
    account.platform !== "whatsapp" ||
    !account.accountId ||
    !account.profileId ||
    !message.id ||
    !r["id"] ||
    !Number.isFinite(at)
  )
    return { events: 1, saved: 0, failures: [] };
  const c = await db();
  const mapped = await c
    .from("wa_channels")
    .select("tenant_id")
    .eq("account_id", account.accountId)
    .eq("profile_id", account.profileId)
    .maybeSingle();
  if (mapped.error) return { events: 1, saved: 0, failures: ["Receipt account lookup failed"] };
  if (!mapped.data) return { events: 1, saved: 0, failures: [] };
  const result = await c.rpc("wa_record_delivery", {
    p_tenant: mapped.data.tenant_id,
    p_event: r["id"],
    p_message: message.platformMessageId ?? message.id,
    p_status: status,
    p_at: new Date(at).toISOString(),
  });
  return {
    events: 1,
    saved: 0,
    failures: result.error ? ["Receipt could not be saved"] : [],
    tenantId: mapped.data.tenant_id,
  };
}
