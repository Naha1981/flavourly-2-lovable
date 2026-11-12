/**
 * WhatsApp marketing opt-out register (STOP/UNSUBSCRIBE compliance).
 *
 * A guest who texts STOP (or an equivalent keyword) must stop receiving
 * automated follow-ups: campaigns, lifecycle messages and auto-replies.
 * Replies to a message the guest just sent in an open conversation are
 * transactional and stay allowed; the outbox only blocks automated jobs.
 *
 * Keyword set follows the WhatsApp opt-out convention, minus "cancel"/"end"
 * which collide with the booking flow's cancel words.
 */
import { db } from "./db.server";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "opt out", "optout", "quit"]);
const START_WORDS = new Set(["start", "unstop", "subscribe", "resubscribe"]);

export function optOutKeyword(text: string): "stop" | "start" | null {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, "");
  if (STOP_WORDS.has(t)) return "stop";
  if (START_WORDS.has(t)) return "start";
  return null;
}

const normalise = (phone: string) => phone.replace(/\D/g, "");

export async function isOptedOut(tenantId: string, phone: string): Promise<boolean> {
  const c = await db();
  const { data, error } = await c
    .from("wa_opt_outs")
    .select("phone")
    .eq("tenant_id", tenantId)
    .eq("phone", normalise(phone))
    .maybeSingle();
  if (error) {
    // Fail closed for marketing: if the register can't be read, don't send automated messages.
    console.error("opt-out check failed", tenantId, error);
    return true;
  }
  return data != null;
}

export async function recordOptOut(tenantId: string, phone: string, source = "whatsapp_keyword"): Promise<void> {
  const c = await db();
  const p = normalise(phone);
  const { data } = await c.from("wa_opt_outs").select("phone").eq("tenant_id", tenantId).eq("phone", p).maybeSingle();
  if (data) return;
  const { error } = await c.from("wa_opt_outs").insert({ tenant_id: tenantId, phone: p, source });
  if (error && error.code !== "23505") console.error("failed to record opt-out", tenantId, error);
}

export async function recordOptIn(tenantId: string, phone: string): Promise<void> {
  const c = await db();
  const { error } = await c.from("wa_opt_outs").delete().eq("tenant_id", tenantId).eq("phone", normalise(phone));
  if (error) console.error("failed to record opt-in", tenantId, error);
}
