import { db } from "./db.server";
import { nextFeedbackStep, type FeedbackState } from "./feedback";
import { reservationStart } from "./booking/reminders";
import { enqueueOutbox } from "./outbox.server";
import { sastDateString } from "./whatsapp/quiet-hours";

const HOUR = 3_600_000;
const COMMENT_WINDOW_MS = 6 * HOUR;
const REPLY_WINDOW_MS = 36 * HOUR;

/**
 * Asks guests how their evening was ~2h after their booking. Only for guests who
 * actually came (seated/completed, or confirmed attendance), never no-shows or cancellations.
 */
export async function runFeedbackRequests(now: Date = new Date()) {
  const c = await db();
  const { data: rows, error } = await c
    .from("reservations")
    .select(
      "id, tenant_id, customer_phone, customer_name, reservation_date, reservation_time, status, attendance_confirmed_at",
    )
    .in("status", ["confirmed", "seated", "completed"])
    .gte("reservation_date", sastDateString(new Date(now.getTime() - 2 * 86_400_000)))
    .lte("reservation_date", sastDateString(now));
  if (error) throw error;

  const { data: venues } = await c
    .from("tenant_profiles")
    .select("tenant_id, name, auto_replies_enabled");
  const venueBy = new Map((venues ?? []).map((v) => [v.tenant_id as string, v]));

  let queued = 0;
  for (const r of rows ?? []) {
    const venue = venueBy.get(r.tenant_id as string);
    if (!venue?.auto_replies_enabled) continue;
    const attended = r.status !== "confirmed" || r.attendance_confirmed_at !== null;
    if (!attended) continue;
    const start = reservationStart(
      r.reservation_date as string,
      (r.reservation_time as string).slice(0, 5),
    );
    const age = now.getTime() - start.getTime();
    if (age < 2 * HOUR || age > 26 * HOUR) continue;

    const { error: insErr } = await c.from("feedback_requests").insert({
      tenant_id: r.tenant_id,
      reservation_id: r.id,
      customer_phone: r.customer_phone,
      customer_name: r.customer_name,
    });
    if (insErr) {
      if (insErr.code === "23505") continue; // already asked
      throw insErr;
    }
    const first = ((r.customer_name as string) ?? "").split(" ")[0] || "there";
    await enqueueOutbox({
      tenantId: r.tenant_id as string,
      phone: r.customer_phone as string,
      text: `Thanks for dining with us at ${venue.name}, ${first}! How was your evening? Reply with a number from 1 (poor) to 5 (excellent).`,
      automated: true,
      dedupeKey: `feedback:${r.id}`,
    });
    queued += 1;
  }
  return { candidates: rows?.length ?? 0, queued };
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
      ? `We're so glad, ${first}! If you have a minute, a Google review helps a small team enormously: ${link}`
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
  return `I'm sorry we fell short, ${first}. What went wrong? Your reply goes straight to our manager.`;
}
