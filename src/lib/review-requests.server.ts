import { db, APP_URL } from "./db.server";
import { channel, sendText } from "./whatsapp.server";
import { isOptedOut } from "./opt-out.server";
import { REVIEW_DELAYS, reviewMessage, safeReviewUrl, type ReviewStep } from "./review-rules";
export async function runReviewRequests(now = new Date()) {
  if (process.env["REVIEW_AUTOMATION_ENABLED"] !== "true")
    return { paused: true, accepted: 0, held: 0 };
  const c = await db();
  const { data: rows, error } = await c
    .from("review_followups")
    .select("*")
    .eq("state", "scheduled")
    .lte("due_at", now.toISOString())
    .order("due_at")
    .limit(100);
  if (error) throw error;
  let accepted = 0,
    held = 0;
  for (const row of rows ?? []) {
    const { data: venue, error: ve } = await c
      .from("tenant_profiles")
      .select("name,google_review_url,review_requests_enabled")
      .eq("tenant_id", row.tenant_id)
      .maybeSingle();
    if (ve || !venue?.review_requests_enabled || process.env["WHATSAPP_SEND_ENABLED"] !== "true")
      continue;
    const claimed = await c.rpc("claim_review_followup", { p_id: row.id });
    if (claimed.error || claimed.data !== true) continue;
    const patch = async (values: Record<string, unknown>) => {
      const r = await c
        .from("review_followups")
        .update(values)
        .eq("id", row.id)
        .eq("tenant_id", row.tenant_id)
        .eq("state", "processing");
      if (r.error) throw r.error;
    };
    if (await isOptedOut(row.tenant_id, row.phone)) {
      await patch({ state: "cancelled", error: "Customer opted out" });
      continue;
    }
    const consent = await c
      .from("customers")
      .select("review_consent_at")
      .eq("tenant_id", row.tenant_id)
      .eq("id", row.customer_id)
      .maybeSingle();
    if (consent.error || !consent.data?.review_consent_at) {
      await patch({ state: "cancelled", error: "Review consent unavailable" });
      continue;
    }
    // Re-read click immediately before a reminder. Clicks never mean a review was posted.
    const latest = await c
      .from("review_followups")
      .select("clicked_at")
      .eq("id", row.id)
      .eq("tenant_id", row.tenant_id)
      .maybeSingle();
    if (latest.error || (row.step === "reminder" && latest.data?.clicked_at)) {
      await patch({ state: "cancelled" });
      continue;
    }
    if (now.getTime() - Date.parse(row.due_at) > 24 * 3600000) {
      await patch({
        state: "held",
        error: "Followup expired while paused; manager review required",
      });
      held++;
      continue;
    }
    const destination = safeReviewUrl(String(row.review_url ?? venue.google_review_url ?? ""));
    const base = APP_URL();
    const binding = await channel(row.tenant_id);
    if (!destination || !base.startsWith("https://") || !binding?.account_id) {
      await patch({
        state: "held",
        error: "Review link, secure app address or number needs manager setup",
      });
      held++;
      continue;
    }
    await patch({ review_url: destination });
    const result = await sendText(
      row.tenant_id,
      binding.account_id,
      row.phone,
      reviewMessage(row.step as ReviewStep, venue.name, `${base}/review/${row.token}`),
    );
    if (!result.ok) {
      await patch({ state: "held", error: result.error });
      held++;
      continue;
    }
    accepted++;
    const next = row.step === "check_in" ? "review" : row.step === "review" ? "reminder" : null;
    await patch(
      next
        ? {
            state: "scheduled",
            step: next,
            due_at: new Date(now.getTime() + REVIEW_DELAYS[next]).toISOString(),
            error: null,
          }
        : { state: "done", error: null },
    );
  }
  return { paused: false, accepted, held };
}
export async function followReviewLink(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await (await db()).rpc("click_review_link", { p_token: token });
  return result.error ? null : safeReviewUrl(String(result.data ?? ""));
}

/** Low ratings become inbox handoffs, never a reason to suppress the neutral review ask. */
export async function flagReviewFeedback(
  tenantId: string,
  phone: string,
  text: string,
  conversationId: string,
) {
  if (!/^\s*[1-3](?:\s*(?:\/\s*5|stars?))?[.!]?\s*$/i.test(text)) return false;
  const c = await db();
  const { data } = await c
    .from("review_followups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", phone.replace(/\D/g, ""))
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  const { error } = await c
    .from("wa_conversations")
    .update({
      status: "needs_approval",
      next_action:
        "Guest left a low rating after a visit. Please follow up. Their neutral review invitation is unchanged.",
    })
    .eq("tenant_id", tenantId)
    .eq("id", conversationId);
  if (error) throw error;
  return true;
}
