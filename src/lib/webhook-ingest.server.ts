/**
 * Turns a verified WhatsApp webhook payload into saved conversations/messages.
 * Tenant and account identity are mandatory because this endpoint serves many restaurants.
 */

type Incoming = {
  tenantId: string;
  chatId: string;
  phone: string | null;
  name: string | null;
  body: string;
  waMessageId: string | null;
  waAccountId: string | null;
  sentAt: string;
  fromMe: boolean;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    let cur: unknown = o;
    for (const p of k.split(".")) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

function parseEvent(raw: unknown): Incoming | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const ev = (root["data"] ?? root["message"] ?? root["payload"] ?? root) as Record<string, unknown>;
  if (!ev || typeof ev !== "object") return null;

  const body =
    str(pick(ev, ["text", "body", "message", "content", "message.conversation", "conversation"])) ??
    str(pick(root, ["text", "body"]));
  if (!body) return null;

  const chatRaw =
    str(pick(ev, ["chatId", "chat_id", "from", "remoteJid", "key.remoteJid", "jid", "sender"])) ??
    str(pick(root, ["chatId", "from"]));
  if (!chatRaw) return null;

  const phone = chatRaw.replace(/@.*$/, "").replace(/\D/g, "") || null;
  const tenantId = str(pick(root, ["tenantId", "tenant_id", "tenant"])) ?? str(pick(ev, ["tenantId", "tenant_id"]));
  const waAccountId = str(pick(root, ["waAccountId", "accountId"])) ?? str(pick(ev, ["waAccountId", "accountId"]));
  if (!tenantId || !waAccountId) return null;

  const tsRaw = pick(ev, ["timestamp", "sentAt", "messageTimestamp", "t"]);
  let sentAt = new Date().toISOString();
  if (typeof tsRaw === "number") sentAt = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000).toISOString();
  else if (typeof tsRaw === "string" && !Number.isNaN(Date.parse(tsRaw))) sentAt = new Date(tsRaw).toISOString();

  return {
    tenantId, chatId: chatRaw, phone,
    name: str(pick(ev, ["pushName", "name", "senderName", "contact.name", "notifyName"])),
    body,
    waMessageId: str(pick(ev, ["id", "messageId", "key.id"])),
    waAccountId, sentAt,
    fromMe: Boolean(pick(ev, ["fromMe", "key.fromMe", "outgoing"])),
  };
}

function classify(text: string): { intent: string; urgency: string } {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("complain", "terrible", "awful", "refund", "cold food", "rude", "disgusting", "worst", "sick")) return { intent: "complaint", urgency: "high" };
  if (has("book", "table", "reserve", "reservation", "seat", "tonight", "party of")) return { intent: "booking", urgency: "medium" };
  if (has("cater", "function", "event", "private room", "wedding")) return { intent: "catering", urgency: "medium" };
  if (has("menu", "hours", "open", "park", "vegan", "halaal", "halal", "allerg", "price")) return { intent: "faq", urgency: "normal" };
  return { intent: "other", urgency: "normal" };
}

export function splitEvents(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const msgs = (parsed as Record<string, unknown> | null)?.["messages"];
  return Array.isArray(msgs) ? msgs : [parsed];
}

export function tenantOf(parsed: unknown): string | null {
  for (const e of splitEvents(parsed)) {
    const m = parseEvent(e);
    if (m) return m.tenantId;
  }
  return null;
}

export type IngestResult = { events: number; saved: number; failures: string[] };

export async function ingestPayload(parsed: unknown): Promise<IngestResult> {
  const events = splitEvents(parsed);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let saved = 0;
  const failures: string[] = [];

  for (const item of events) {
    const msg = parseEvent(item);
    if (!msg) continue;

    // Duplicate delivery must be a complete no-op before touching the conversation.
    if (msg.waMessageId) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("wa_messages").select("id").eq("wa_message_id", msg.waMessageId).maybeSingle();
      if (duplicateError) { failures.push("duplicate-check: " + duplicateError.message); continue; }
      if (duplicate) continue;
    }

    const { intent, urgency } = classify(msg.body);
    const { data: existing, error: findError } = await supabaseAdmin
      .from("wa_conversations").select("id, unread, status").eq("tenant_id", msg.tenantId).eq("chat_id", msg.chatId).maybeSingle();
    if (findError) { failures.push("lookup: " + findError.message); continue; }

    let conversationId = existing?.id ?? null;
    if (conversationId) {
      const { error } = await supabaseAdmin.from("wa_conversations").update({
        last_message: msg.body.slice(0, 400),
        last_message_at: msg.sentAt,
        unread: msg.fromMe ? (existing?.unread ?? 0) : (existing?.unread ?? 0) + 1,
        ...(msg.fromMe ? {} : {
          intent, urgency,
          status: existing?.status === "resolved" ? "open" : (existing?.status ?? "open"),
          ...(msg.name ? { guest_name: msg.name } : {}),
        }),
      }).eq("id", conversationId);
      if (error) { failures.push("update: " + error.message); continue; }
    } else {
      const { data: created, error } = await supabaseAdmin.from("wa_conversations").insert({
        tenant_id: msg.tenantId, chat_id: msg.chatId,
        guest_name: msg.name ?? msg.phone, guest_phone: msg.phone,
        intent, urgency, status: "open", unread: msg.fromMe ? 0 : 1,
        last_message: msg.body.slice(0, 400), last_message_at: msg.sentAt,
      }).select("id").single();
      if (error || !created) { failures.push("conversation: " + (error?.message ?? "not created")); continue; }
      conversationId = created.id;
    }

    const { error: msgError } = await supabaseAdmin.from("wa_messages").insert({
      conversation_id: conversationId, tenant_id: msg.tenantId, wa_message_id: msg.waMessageId,
      direction: msg.fromMe ? "out" : "in", body: msg.body, sent_at: msg.sentAt,
    });
    if (msgError) {
      // Another worker can win a race between the duplicate check and insert.
      if (msgError.code === "23505") continue;
      failures.push("message: " + msgError.message);
      continue;
    }
    saved += 1;

    if (!msg.fromMe && msg.phone) {
      try {
        const { autoReply } = await import("@/lib/auto-reply.server");
        await autoReply({ tenantId: msg.tenantId, phone: msg.phone, name: msg.name, text: msg.body, conversationId: conversationId as string, waAccountId: msg.waAccountId });
      } catch (e) {
        console.error("auto-reply failed", msg.tenantId, e);
      }
    }
  }
  return { events: events.length, saved, failures };
}