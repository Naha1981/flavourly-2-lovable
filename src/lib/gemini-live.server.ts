import { db } from "./db.server";
import { formatZAR } from "./south-africa";
import type { FlavourlyLiveToolName } from "./gemini-live.tools";

type ToolArgs = Record<string, unknown>;

const clampLimit = (value: unknown, fallback = 5) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(10, Math.max(1, Math.floor(n)));
};

const todaySast = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export async function executeFlavourlyLiveTool(
  tenantId: string,
  name: FlavourlyLiveToolName,
  args: ToolArgs,
) {
  const { assertAiBudget } = await import("./ai-budget.server");
  await assertAiBudget(tenantId, "gemini-live-tool:" + name);
  const c = await db();

  if (name === "get_restaurant_overview") {
    const { data, error } = await c
      .from("tenant_profiles")
      .select("tenant_id, name, whatsapp_phone, manager_phone, auto_replies_enabled")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, error: "Restaurant profile is not configured." };

    return {
      ok: true,
      restaurant: {
        tenantId: data.tenant_id,
        name: data.name,
        whatsappPhoneConfigured: Boolean(data.whatsapp_phone),
        managerPhoneConfigured: Boolean(data.manager_phone),
        autoRepliesEnabled: Boolean(data.auto_replies_enabled),
      },
    };
  }

  if (name === "get_revenue_status") {
    return {
      ok: true,
      available: false,
      message:
        "Verified payment/revenue transactions are not wired into the current Flavourly schema. Do not provide a revenue number from assumptions or mock data.",
    };
  }

  if (name === "get_today_bookings") {
    const limit = clampLimit(args["limit"], 8);
    const day = todaySast();
    const { data, error } = await c
      .from("reservations")
      .select(
        "id, customer_name, customer_phone, party_size, reservation_date, reservation_time, special_requests, status",
      )
      .eq("tenant_id", tenantId)
      .eq("reservation_date", day)
      .order("reservation_time", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      ok: true,
      date: day,
      bookings: (data ?? []).map((row) => ({
        id: row.id,
        customerName: row.customer_name,
        phone: row.customer_phone,
        partySize: row.party_size,
        time: row.reservation_time,
        specialRequests: row.special_requests,
        status: row.status,
      })),
    };
  }

  if (name === "get_menu_performance") {
    const limit = clampLimit(args["limit"], 6);
    const { data, error } = await c
      .from("menu_items")
      .select("id, name, price_cents, cost_price_cents, is_available, sales_count_30d")
      .eq("tenant_id", tenantId)
      .order("sales_count_30d", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      ok: true,
      basis: "sales_count_30d",
      items: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        price: formatZAR(row.price_cents),
        costPriceAvailable: row.cost_price_cents !== null,
        available: Boolean(row.is_available),
        salesLast30Days: row.sales_count_30d,
      })),
    };
  }

  if (name === "get_inbox_summary") {
    const limit = clampLimit(args["limit"], 6);
    const { data, error } = await c
      .from("wa_conversations")
      .select(
        "id, guest_name, guest_phone, status, urgency, intent, unread, last_message, last_message_at",
      )
      .eq("tenant_id", tenantId)
      .in("status", ["open", "needs_approval"])
      .order("last_message_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const conversations = data ?? [];
    return {
      ok: true,
      openCount: conversations.length,
      unreadCount: conversations.reduce((sum, row) => sum + Number(row.unread ?? 0), 0),
      highUrgencyCount: conversations.filter((row) => row.urgency === "high").length,
      conversations: conversations.map((row) => ({
        id: row.id,
        guestName: row.guest_name ?? row.guest_phone ?? "Guest",
        status: row.status,
        urgency: row.urgency,
        intent: row.intent,
        unread: row.unread,
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
      })),
    };
  }

  if (name === "get_vip_customers") {
    const limit = clampLimit(args["limit"], 6);
    const { data, error } = await c
      .from("customers")
      .select("id, name, phone, total_spend_cents, visit_count, is_vip, last_visit_at")
      .eq("tenant_id", tenantId)
      .or("is_vip.eq.true,total_spend_cents.gte.500000")
      .order("total_spend_cents", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return {
      ok: true,
      customers: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name ?? row.phone,
        totalSpend: formatZAR(row.total_spend_cents),
        visitCount: row.visit_count,
        isVip: Boolean(row.is_vip),
        lastVisitAt: row.last_visit_at,
      })),
    };
  }

  if (name === "draft_promotion") {
    const theme = String(args["theme"] ?? "").trim().slice(0, 120);
    const offer = String(args["offer"] ?? "").trim().slice(0, 180);
    const audience = String(args["audience"] ?? "").trim().slice(0, 120);

    if (!theme) return { ok: false, error: "Promotion theme is required." };

    const [{ data: venue, error: venueError }, { data: top, error: menuError }] =
      await Promise.all([
        c.from("tenant_profiles").select("name").eq("tenant_id", tenantId).maybeSingle(),
        c
          .from("menu_items")
          .select("name, price_cents")
          .eq("tenant_id", tenantId)
          .eq("is_available", true)
          .order("sales_count_30d", { ascending: false })
          .limit(3),
      ]);

    if (venueError) throw venueError;
    if (menuError) throw menuError;
    if (!venue) return { ok: false, error: "Restaurant profile is not configured." };
    if (!top?.length) return { ok: false, error: "No available menu items are configured." };

    const dishes = top
      .map((row) => `${row.name} (${formatZAR(row.price_cents)})`)
      .join(" · ");

    const caption = [
      `${theme} at ${venue.name}.`,
      dishes ? `Guest favourites right now: ${dishes}.` : "",
      audience ? `For ${audience}.` : "",
      offer ? offer : "",
      "Book your table and join us.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { data: draft, error } = await c
      .from("social_content_drafts")
      .insert({
        tenant_id: tenantId,
        caption,
        status: "pending_approval",
      })
      .select("id, caption, status, created_at")
      .single();

    if (error) throw error;

    return {
      ok: true,
      draftId: draft.id,
      status: draft.status,
      caption: draft.caption,
      message: "Draft created for manager approval. It was not published or sent.",
    };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}
