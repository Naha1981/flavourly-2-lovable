import { APP_URL, db } from "./db.server";
import { handleBookingMessage } from "./booking/machine.server";
import {
  awardWelcomeBonus,
  createClaim,
  getBalance,
  upsertCustomer,
  WELCOME_POINTS,
} from "./loyalty.server";
import { formatZAR } from "./south-africa";
import { sendWhatsApp } from "./wa-account.server";
import { decideApproval } from "./approval-classifier";
import { enqueueOutbox } from "./outbox.server";

/**
 * Deterministic auto-replies for inbound WhatsApp messages: JOIN, BALANCE,
 * REDEEM and the booking conversation. Replies to a guest who just wrote in are
 * not "automated marketing", so they are exempt from the 07:00–20:00 window.
 * Off by default per venue (tenant_profiles.auto_replies_enabled).
 */
export async function autoReply(input: {
  tenantId: string;
  phone: string;
  name: string | null;
  text: string;
  conversationId: string;
  waAccountId?: string | null;
  waMessageId?: string | null;
  durable?: {
    beforeSend: (text: string) => Promise<boolean>;
    accepted: (messageId: string) => Promise<void>;
  };
}): Promise<{ replied: boolean; heldForApproval?: boolean }> {
  const c = await db();
  // Synthetic workspaces must never answer the owner's normal contacts.
  if (input.tenantId.startsWith("synthetic")) {
    const allowed = await c
      .from("wa_reply_test_targets")
      .select("phone")
      .eq("tenant_id", input.tenantId)
      .eq("phone", input.phone.replace(/\D/g, ""))
      .maybeSingle();
    if (allowed.error || !allowed.data || !/^SYNTHETIC QA enquiry(?: \d+)?:/.test(input.text))
      return { replied: false, heldForApproval: true };
  }
  const { data: venue } = await c
    .from("tenant_profiles")
    .select("auto_replies_enabled, name")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!venue?.auto_replies_enabled) return { replied: false };

  const { isOptedOut } = await import("./opt-out.server");
  if (await isOptedOut(input.tenantId, input.phone)) return { replied: false };

  const { data: conversation } = await c
    .from("wa_conversations")
    .select("status, assignee")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.conversationId)
    .maybeSingle();
  if (conversation?.assignee || conversation?.status === "needs_approval")
    return { replied: false, heldForApproval: true };
  const handoff = /\b(manager|human|person|complaints?|refunds?|allerg\w*|sick|lawyer)\b/i.test(
    input.text,
  );
  if (handoff) {
    await c
      .from("wa_conversations")
      .update({
        status: "needs_approval",
        urgency: "high",
        next_action: "Customer needs a manager. Automatic replies paused.",
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.conversationId);
    return { replied: false, heldForApproval: true };
  }
  let reply = await decide(input, (venue.name as string) ?? "us");
  if (!reply) {
    const budget = await c.rpc("wa_reserve_budget", { p_tenant: input.tenantId, p_kind: "draft" });
    if (budget.error || budget.data !== true) {
      await c
        .from("wa_conversations")
        .update({
          status: "needs_approval",
          next_action: "Draft limit reached. Team reply needed.",
        })
        .eq("tenant_id", input.tenantId)
        .eq("id", input.conversationId);
      return { replied: false, heldForApproval: true };
    }
    const { generateReplyDraft, buildMenuFacts } = await import("./reply-drafts.server");
    const { data: menu } = await c
      .from("menu_items")
      .select("name, description, price_cents, is_available, dietary_flags")
      .eq("tenant_id", input.tenantId)
      .limit(80);
    const draft = await generateReplyDraft({
      message: input.text,
      intent: "auto",
      restaurant: { name: venue.name },
      menuFacts: buildMenuFacts(menu ?? []),
    });
    if (!draft.ok) throw new Error("Draft unavailable");
    reply = draft.reply;
  }
  if (!reply) return { replied: false };

  if (/manager needs to check/i.test(reply)) {
    await c
      .from("wa_conversations")
      .update({
        status: "needs_approval",
        next_action: "Booking needs a manager capacity check. No table confirmed.",
      })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.conversationId);
  }
  const decision = decideApproval(reply);
  if (decision.outcome === "require_approval") {
    const outboxInput: Parameters<typeof enqueueOutbox>[0] = {
      tenantId: input.tenantId,
      phone: input.phone,
      text: reply,
      automated: true,
      conversationId: input.conversationId,
    };
    if (input.waMessageId) outboxInput.dedupeKey = "autoreply:" + input.waMessageId;
    const held = await enqueueOutbox(outboxInput);
    await c
      .from("wa_conversations")
      .update({ status: "needs_approval" })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.conversationId);
    return { replied: false, heldForApproval: held.approvalRequired };
  }

  if (input.durable && !(await input.durable.beforeSend(reply)))
    return { replied: false, heldForApproval: true };
  const sent = await sendWhatsApp(input.tenantId, input.phone, reply, input.waAccountId);
  if (!sent.ok && input.durable) throw new Error(sent.error);
  if (!sent.ok) {
    await enqueueOutbox({
      tenantId: input.tenantId,
      phone: input.phone,
      text: reply,
      automated: true,
      conversationId: input.conversationId,
      ...(input.waMessageId ? { dedupeKey: "held:" + input.waMessageId } : {}),
      forceApproval: true,
    });
    await c
      .from("wa_conversations")
      .update({ status: "needs_approval", next_action: "Reply held. Review before sending." })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.conversationId);
    console.error("auto-reply send failed", input.tenantId, sent.error);
    return { replied: false, heldForApproval: true };
  }
  if (input.durable) {
    if (!sent.data.messageId) throw new Error("Provider acceptance is uncertain; do not resend.");
    await input.durable.accepted(sent.data.messageId);
    return { replied: true };
  }
  const now = new Date().toISOString();
  await c.from("wa_messages").insert({
    conversation_id: input.conversationId,
    tenant_id: input.tenantId,
    wa_message_id: sent.data.messageId ?? null,
    direction: "out",
    delivery_status: "accepted",
    body: reply,
    sent_at: now,
  });
  await c
    .from("wa_conversations")
    .update({ last_message: reply.slice(0, 400), last_message_at: now })
    .eq("id", input.conversationId);
  return { replied: true };
}

async function decide(
  i: { tenantId: string; phone: string; name: string | null; text: string },
  venueName: string,
): Promise<string | null> {
  const t = i.text.trim();

  if (/^join\b/i.test(t)) {
    const r = await awardWelcomeBonus(i.tenantId, i.phone, i.name);
    return r.awarded > 0
      ? `Welcome to ${venueName}! 🎉 You've got *${WELCOME_POINTS} points* to start. Earn 1 point for every R1 you spend, and 100 points = R10 off your bill. Reply *BALANCE* any time.`
      : `You're already in! You have *${r.balance} points*. Reply *REDEEM 100* at the restaurant to use them.`;
  }

  if (/^(balance|points)\s*$/i.test(t)) {
    const customer = await upsertCustomer(i.tenantId, i.phone, i.name);
    const bal = await getBalance(i.tenantId, customer.id);
    return `You have *${bal} points* (worth ${formatZAR(Math.floor(bal / 100) * 1000)} off). Reply *REDEEM 100* at the restaurant to use them.`;
  }

  if (/^(stamps?|visits?|vip)\s*$/i.test(t)) {
    const { data: customer } = await (
      await db()
    )
      .from("customers")
      .select("visit_count, is_vip")
      .eq("tenant_id", i.tenantId)
      .eq("phone", i.phone)
      .maybeSingle();
    return customer
      ? `You have *${customer.visit_count ?? 0} recorded visits*. VIP status: *${customer.is_vip ? "active" : "not yet active"}*. Visits are recorded by staff from your bill, never by a WhatsApp message.`
      : "No visits are recorded for this number yet. Ask a team member to record your bill.";
  }
  const redeem = t.match(/^redeem\s*(\d{2,5})?\s*$/i);
  if (redeem) {
    if (!APP_URL()) return "Please ask a team member to help you redeem at the table.";
    const claim = await createClaim(i.tenantId, i.phone, Number(redeem[1] ?? 100));
    if (!claim.ok) return claim.error;
    return `Tap to unlock your *${formatZAR(claim.discountCents)} off* code (works only at the restaurant, valid 15 minutes):\n${APP_URL()}/geo-claim/${claim.token}`;
  }

  // A YES/CANCEL to a live waitlist offer takes priority over everything below.
  const { handleWaitlistReply } = await import("./waitlist.server");
  const waitlistReply = await handleWaitlistReply({
    tenantId: i.tenantId,
    phone: i.phone,
    text: t,
  });
  if (waitlistReply) return waitlistReply;

  const waitJoin = t.match(/^wait(?:list)?\s+(\d{1,2})\s+(.+)$/i);
  if (waitJoin) {
    const { db } = await import("./db.server");
    const { parseDate } = await import("./booking/parse");
    const party = Number(waitJoin[1]);
    const date = parseDate(waitJoin[2] ?? "", new Date());
    if (!date)
      return "Which date would you like to join the waitlist for? e.g. *WAITLIST 4 Friday*";
    const c = await db();
    await c.from("waitlist_entries").insert({
      tenant_id: i.tenantId,
      customer_phone: i.phone,
      customer_name: i.name,
      party_size: party,
      requested_date: date,
    });
    return `You're on the waitlist for ${party} on ${date}. We'll message you the moment a table opens up.`;
  }

  // A 1-5 rating (or the comment after a low one) answers our feedback request.
  const { handleFeedbackReply } = await import("./reputation.server");
  const feedback = await handleFeedbackReply({ tenantId: i.tenantId, phone: i.phone, text: t });
  if (feedback) return feedback;

  // A YES/CANCEL to a reminder we just sent beats starting a new booking draft.
  const { handleReminderReply } = await import("./reminders.server");
  const reminder = await handleReminderReply({ tenantId: i.tenantId, phone: i.phone, text: t });
  if (reminder) return reminder;

  const booking = await handleBookingMessage({
    tenantId: i.tenantId,
    phone: i.phone,
    guestName: i.name,
    text: t,
  });
  return booking.handled ? (booking.reply ?? null) : null;
}
