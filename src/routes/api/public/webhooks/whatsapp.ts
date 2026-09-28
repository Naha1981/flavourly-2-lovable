import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Incoming WhatsApp webhook from the NahaLabs Baileys operator.
 * Requests are HMAC-SHA256 signed over the raw body with WEBHOOK_SECRET.
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
    const parts = k.split(".");
    let cur: unknown = o;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

/** Accepts the operator's message payloads in a few shapes. */
function parseEvent(raw: unknown): Incoming | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const ev = ((root["data"] ?? root["message"] ?? root["payload"] ?? root) as Record<string, unknown>) ?? root;

  const body =
    str(pick(ev, ["text", "body", "message", "content", "message.conversation", "conversation"])) ??
    str(pick(root, ["text", "body"]));
  if (!body) return null;

  const chatRaw =
    str(pick(ev, ["chatId", "chat_id", "from", "remoteJid", "key.remoteJid", "jid", "sender"])) ??
    str(pick(root, ["chatId", "from"]));
  if (!chatRaw) return null;

  const phone = chatRaw.replace(/@.*$/, "").replace(/\D/g, "") || null;
  const tenantId =
    str(pick(root, ["tenantId", "tenant_id", "tenant"])) ?? str(pick(ev, ["tenantId", "tenant_id"])) ?? "default";

  const tsRaw = pick(ev, ["timestamp", "sentAt", "messageTimestamp", "t"]);
  let sentAt = new Date().toISOString();
  if (typeof tsRaw === "number") sentAt = new Date(tsRaw > 1e12 ? tsRaw : tsRaw * 1000).toISOString();
  else if (typeof tsRaw === "string" && !Number.isNaN(Date.parse(tsRaw))) sentAt = new Date(tsRaw).toISOString();

  const fromMe = Boolean(pick(ev, ["fromMe", "key.fromMe", "outgoing"]));

  return {
    tenantId,
    chatId: chatRaw,
    phone,
    name: str(pick(ev, ["pushName", "name", "senderName", "contact.name", "notifyName"])),
    body,
    waMessageId: str(pick(ev, ["id", "messageId", "key.id"])),
    waAccountId: str(pick(root, ["waAccountId", "accountId"])) ?? str(pick(ev, ["waAccountId", "accountId"])),
    sentAt,
    fromMe,
  };
}

function classify(text: string): { intent: string; urgency: string } {
  const t = text.toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("complain", "terrible", "awful", "refund", "cold food", "rude", "disgusting", "worst", "sick"))
    return { intent: "complaint", urgency: "high" };
  if (has("book", "table", "reserve", "reservation", "seat", "tonight", "party of"))
    return { intent: "booking", urgency: "medium" };
  if (has("cater", "function", "event", "private room", "wedding")) return { intent: "catering", urgency: "medium" };
  if (has("menu", "hours", "open", "park", "vegan", "halaal", "halal", "allerg", "price"))
    return { intent: "faq", urgency: "normal" };
  return { intent: "other", urgency: "normal" };
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const rawBody = await request.text();
        const provided = (
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-signature") ??
          request.headers.get("x-hub-signature-256") ??
          ""
        )
          .replace(/^sha256=/i, "")
          .trim();

        const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const events = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as Record<string, unknown>)["messages"])
            ? ((parsed as Record<string, unknown>)["messages"] as unknown[])
            : [parsed];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let saved = 0;

        for (const item of events) {
          const msg = parseEvent(item);
          if (!msg) continue;

          const { intent, urgency } = classify(msg.body);
          const { data: existing } = await supabaseAdmin
            .from("wa_conversations")
            .select("id, unread, status")
            .eq("tenant_id", msg.tenantId)
            .eq("chat_id", msg.chatId)
            .maybeSingle();

          let conversationId = existing?.id ?? null;

          if (conversationId) {
            await supabaseAdmin
              .from("wa_conversations")
              .update({
                last_message: msg.body.slice(0, 400),
                last_message_at: msg.sentAt,
                unread: msg.fromMe ? (existing?.unread ?? 0) : (existing?.unread ?? 0) + 1,
                ...(msg.fromMe
                  ? {}
                  : {
                      intent,
                      urgency,
                      status: existing?.status === "resolved" ? "open" : (existing?.status ?? "open"),
                      ...(msg.name ? { guest_name: msg.name } : {}),
                    }),
              })
              .eq("id", conversationId);
          } else {
            const { data: created, error } = await supabaseAdmin
              .from("wa_conversations")
              .insert({
                tenant_id: msg.tenantId,
                chat_id: msg.chatId,
                guest_name: msg.name ?? msg.phone,
                guest_phone: msg.phone,
                intent,
                urgency,
                status: "open",
                unread: msg.fromMe ? 0 : 1,
                last_message: msg.body.slice(0, 400),
                last_message_at: msg.sentAt,
              })
              .select("id")
              .single();
            if (error) {
              console.error("conversation insert failed", error);
              continue;
            }
            conversationId = created.id;
          }

          const { error: msgError } = await supabaseAdmin.from("wa_messages").insert({
            conversation_id: conversationId,
            tenant_id: msg.tenantId,
            wa_message_id: msg.waMessageId,
            direction: msg.fromMe ? "out" : "in",
            body: msg.body,
            sent_at: msg.sentAt,
          });
          if (msgError && msgError.code !== "23505") console.error("message insert failed", msgError);
          saved += 1;

          // Duplicate deliveries (unique wa_message_id) must not trigger a second auto-reply.
          if (!msg.fromMe && msg.phone && !msgError) {
            try {
              const { autoReply } = await import("@/lib/auto-reply.server");
              await autoReply({
                tenantId: msg.tenantId,
                phone: msg.phone,
                name: msg.name,
                text: msg.body,
                conversationId: conversationId as string,
                waAccountId: msg.waAccountId,
              });
            } catch (e) {
              console.error("auto-reply failed", e);
            }
          }
        }

        return Response.json({ ok: true, saved });
      },
    },
  },
});
