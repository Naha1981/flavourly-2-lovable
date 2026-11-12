import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.object({ tenantId: z.string().min(1).max(80) });

async function load(tenantId: string) {
  const { db } = await import("./db.server");
  const c = await db();
  const [{ data: conv }, { data: msgs }] = await Promise.all([
    c.from("support_conversations").select("status").eq("tenant_id", tenantId).maybeSingle(),
    c
      .from("support_messages")
      .select("id, role, body, needs_human, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  return { status: (conv?.status ?? "ai") as string, messages: msgs ?? [] };
}

export const getSupportChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tenant.parse(d))
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    return load(data.tenantId);
  });

export const askSupport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tenant.extend({ question: z.string().trim().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { authorizeTenant, actorId } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const author = await actorId();
    const { db } = await import("./db.server");
    const { buildMenuFacts } = await import("./reply-drafts.server");
    const { askSupportModel, decideHandoff, HANDOFF_TEXT } = await import("./support-chat.server");
    const c = await db();
    const t = data.tenantId;

    await c.from("support_conversations").upsert({ tenant_id: t, updated_at: new Date().toISOString() });
    const prior = await load(t);
    const ins = await c
      .from("support_messages")
      .insert({ tenant_id: t, role: "owner", body: data.question, author_id: author });
    if (ins.error) throw new Error("Couldn't save your message.");

    // Once a person has the conversation, don't let the assistant answer over them.
    if (prior.status === "waiting_human") return load(t);

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: profile }, { data: menu }, { data: bookings }] = await Promise.all([
      c.from("tenant_profiles").select("name, city, cuisine, hours, notes, average_check_cents").eq("tenant_id", t).maybeSingle(),
      c.from("menu_items").select("name, description, price_cents, is_available, dietary_flags").eq("tenant_id", t).limit(80),
      c.from("reservations").select("customer_name, party_size, reservation_date, reservation_time, status").eq("tenant_id", t).gte("reservation_date", today).order("reservation_date").limit(40),
    ]);
    const facts = [
      profile ? `Restaurant: ${profile.name}${profile.city ? `, ${profile.city}` : ""}${profile.cuisine ? ` (${profile.cuisine})` : ""}` : "",
      profile?.hours ? `Hours: ${profile.hours}` : "",
      profile?.notes ? `House policies/notes: ${profile.notes}` : "No house policies saved.",
      menu?.length ? `Menu:\n${buildMenuFacts(menu)}` : "No menu loaded.",
      bookings?.length
        ? `Upcoming bookings (${today} onward):\n${bookings.map((b) => `- ${b.reservation_date} ${String(b.reservation_time).slice(0, 5)} ${b.customer_name}, ${b.party_size} people, ${b.status}`).join("\n")}`
        : "No upcoming bookings.",
    ].filter(Boolean).join("\n");

    const res = await askSupportModel({ facts, history: prior.messages, question: data.question });
    const decision = res.ok
      ? decideHandoff(res.answer)
      : { handoff: true, text: res.status === 402 ? "The assistant is paused (AI credits used up). " + HANDOFF_TEXT : HANDOFF_TEXT };

    await c.from("support_messages").insert({ tenant_id: t, role: "assistant", body: decision.text, needs_human: decision.handoff });
    if (decision.handoff) {
      await c.from("support_conversations").update({
        status: "waiting_human",
        handoff_reason: res.ok ? res.answer.reason.slice(0, 300) : `ai_error_${res.status}`,
        handed_off_at: new Date().toISOString(),
      }).eq("tenant_id", t);
    }
    return load(t);
  });

/** Owner can hand the chat back to the assistant once their question is sorted. */
export const resumeAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tenant.parse(d))
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { db } = await import("./db.server");
    await (await db()).from("support_conversations").update({ status: "ai" }).eq("tenant_id", data.tenantId);
    return load(data.tenantId);
  });
