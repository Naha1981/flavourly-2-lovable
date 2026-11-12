/** Transactional mail to the authenticated workspace member only. OFF until approved. */
import { createHash } from "node:crypto";
import { db } from "./db.server";
export type NotificationKind = "welcome" | "paid_visit";
export function notificationCopy(kind: NotificationKind) {
  return kind === "welcome"
    ? {
        subject: "Your Flavourly workspace is ready",
        text: "Your Flavourly workspace has been created. Set up your venue, review your permissions and check your inbox. Customer messaging stays paused until connection and activation checks are complete.",
      }
    : {
        subject: "Paid visit recorded in Flavourly",
        text: "A paid visit was recorded in your Flavourly workspace. Open Reputation to check the review followup status. Recording a visit does not take payment, and review messages stay subject to consent, activation and reply limits.",
      };
}
export async function notifyMember(
  tenantId: string,
  userId: string,
  kind: NotificationKind,
  eventKey: string,
) {
  if (process.env["NOTIFICATION_EMAIL_ENABLED"] !== "true") return { status: "paused" };
  const key = process.env["RESEND_API_KEY"],
    from = process.env["NOTIFICATION_EMAIL_FROM"];
  if (!key || !from) return { status: "unconfigured" };
  const c = await db();
  const member = await c
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member.error || !member.data) return { status: "forbidden" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const account = await supabaseAdmin.auth.admin.getUserById(userId);
  const to = account.data.user?.email;
  if (account.error || !to || !account.data.user?.email_confirmed_at)
    return { status: "unverified_recipient" };
  const reserve = await c.rpc("reserve_notification", {
    p_tenant: tenantId,
    p_user: userId,
    p_kind: kind,
    p_event: eventKey,
  });
  if (reserve.error || reserve.data !== true) return { status: "held" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key":
          "flavourly-" +
          createHash("sha256")
            .update(JSON.stringify([tenantId, userId, kind, eventKey]))
            .digest("hex"),
      },
      body: JSON.stringify({ from, to: [to], ...notificationCopy(kind) }),
      signal: AbortSignal.timeout(10000),
    });
    const status = response.ok ? "accepted" : "held";
    await c
      .from("notification_attempts")
      .update({ status })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("kind", kind)
      .eq("event_key", eventKey);
    return { status };
  } catch {
    return { status: "held" };
  }
}
