import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80);

export type InboxConversation = {
  id: string;
  chatId: string;
  guestName: string;
  guestPhone: string | null;
  status: string;
  urgency: string;
  intent: string;
  summary: string | null;
  nextAction: string | null;
  assignee: string | null;
  unread: number;
  lastMessage: string | null;
  lastMessageAt: string;
};

export type InboxMessage = {
  id: string;
  direction: string;
  body: string;
  sentAt: string;
};

export const listConversations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<InboxConversation[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("wa_conversations")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("listConversations", error);
      return [];
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      guestName: r.guest_name ?? r.guest_phone ?? "WhatsApp guest",
      guestPhone: r.guest_phone,
      status: r.status,
      urgency: r.urgency,
      intent: r.intent,
      summary: r.summary,
      nextAction: r.next_action,
      assignee: r.assignee,
      unread: r.unread,
      lastMessage: r.last_message,
      lastMessageAt: r.last_message_at,
    }));
  });

export const listMessages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<InboxMessage[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("wa_messages")
      .select("id, direction, body, sent_at")
      .eq("tenant_id", data.tenantId)
      .eq("conversation_id", data.conversationId)
      .order("sent_at", { ascending: true })
      .limit(200);
    if (error) {
      console.error("listMessages", error);
      return [];
    }
    return (rows ?? []).map((r) => ({ id: r.id, direction: r.direction, body: r.body, sentAt: r.sent_at }));
  });

export const updateConversation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        conversationId: z.string().uuid(),
        assignee: z.string().max(80).nullable().optional(),
        status: z.enum(["open", "needs_approval", "resolved"]).optional(),
        markRead: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { assignee?: string | null; status?: string; unread?: number } = {};
    if (data.assignee !== undefined) patch.assignee = data.assignee;
    if (data.status !== undefined) patch.status = data.status;
    if (data.markRead) patch.unread = 0;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("wa_conversations")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.conversationId);
    if (error) {
      console.error("updateConversation", error);
      return { ok: false, error: "Couldn't save that change." };
    }
    return { ok: true };
  });
