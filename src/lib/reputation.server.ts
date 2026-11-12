import { db } from "./db.server";
import { nextFeedbackStep, type FeedbackState } from "./feedback";
import { enqueueOutbox } from "./outbox.server";

const HOUR = 3_600_000;
const COMMENT_WINDOW_MS = 6 * HOUR;
const REPLY_WINDOW_MS = 36 * HOUR;

/**
 * Asks guests how their evening was ~2h after their booking. Only for guests who
 * actually came (seated/completed, or confirmed attendance), never no-shows or cancellations.
 */
export async function runFeedbackRequests(_now: Date = new Date()) {
  return { candidates: 0, queued: 0 };
}

async function alertManager(tenantId: string, incidentId: string, kind: string, text: string) {
  const c = await db();
  const { data } = await c
    .from("tenant_profiles")
    .select("manager_phone")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const phone = data?.manager_phone as string | null | undefined;
  if (!phone) return;
  // Operational alert to the team, not marketing: not held back by the send window.
  await enqueueOutbox({
    tenantId,
    phone,
    text,
    automated: false,
    dedupeKey: `incident-alert:${incidentId}:${kind}`,
  });
}

/** Handles a guest's rating or comment. Returns the reply to send, or null if this isn't feedback. */
export async function handleFeedbackReply(input: {
  tenantId: string;
  phone: string;
  text: string;
  now?: Date;
}): Promise<string | null> {
  const now = input.now ?? new Date();
  const c = await db();
  const phone = input.phone.replace(/\D/g, "");
  const { data: rows } = await c
    .from("feedback_requests")
    .select("id, state, incident_id, customer_name, updated_at, created_at")
    .eq("tenant_id", input.tenantId)
    .eq("customer_phone", phone)
    .in("state", ["asked", "awaiting_comment"])
    .gt("created_at", new Date(now.getTime() - REPLY_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const req = rows?.[0];
  if (!req) return null;
  const state = req.state as FeedbackState;
  if (
    state === "awaiting_comment" &&
    now.getTime() - new Date(req.updated_at as string).getTime() > COMMENT_WINDOW_MS
  )
    return null;

  const step = nextFeedbackStep(state, input.text);
  if (!step) return null;

  const { data: venue } = await c
    .from("tenant_profiles")
    .select("name, google_review_url")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  const name = (req.customer_name as string | null) ?? "A guest";
  const first = name.split(" ")[0] || "there";
  const stamp = now.toISOString();

  if (step.kind === "comment") {
    await c
      .from("reputation_incidents")
      .update({ feedback_text: step.text })
      .eq("id", req.incident_id);
    await c.from("feedback_requests").update({ state: "done", updated_at: stamp }).eq("id", req.id);
    await alertManager(
      input.tenantId,
      req.incident_id as string,
      "comment",
      `${name} added: "${step.text.slice(0, 300)}"`,
    );
    return "Thank you for telling us. A manager will reach out to make this right.";
  }

  if (step.rating >= 4) {
    await c
      .from("feedback_requests")
      .update({ state: "done", rating: step.rating, updated_at: stamp })
      .eq("id", req.id);
    const link = venue?.google_review_url as string | null | undefined;
    return link
      ? `Thank you for your feedback, ${first}. You can share your honest experience in a Google review: ${link}`
      : `We're so glad you enjoyed it, ${first}! See you again soon.`;
  }

  let incidentId = req.incident_id as string | null;
  if (incidentId) {
    await c.from("reputation_incidents").update({ rating: step.rating }).eq("id", incidentId);
  } else {
    const { data: created, error } = await c
      .from("reputation_incidents")
      .insert({
        tenant_id: input.tenantId,
        customer_phone: phone,
        customer_name: req.customer_name,
        rating: step.rating,
      })
      .select("id")
      .single();
    if (error) throw error;
    incidentId = created.id as string;
    await alertManager(
      input.tenantId,
      incidentId,
      "new",
      `${step.rating}★ feedback from ${name} (${phone}). Open Reputation in Flavourly to respond.`,
    );
  }
  await c
    .from("feedback_requests")
    .update({
      state: "awaiting_comment",
      rating: step.rating,
      incident_id: incidentId,
      updated_at: stamp,
    })
    .eq("id", req.id);
  const link = venue?.google_review_url as string | null | undefined;
  return (
    `I'm sorry we fell short, ${first}. What went wrong? Your reply goes to our manager.` +
    (link ? ` You can also share your honest experience in a Google review: ${link}` : "")
  );
}
