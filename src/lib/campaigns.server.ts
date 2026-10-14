import { assignVariant, ATTRIBUTION_WINDOW_DAYS } from "./campaigns";
import { db } from "./db.server";
import { enqueueOutbox } from "./outbox.server";

export const CAMPAIGN_ATTRIBUTION_RULE =
  `Guest spend recorded within ${ATTRIBUTION_WINDOW_DAYS} days of campaign send. ` +
  "Association under a stated rule, not proof of causation.";
export const CAMPAIGN_BASELINE_RULE =
  "Variant A recipients as the comparison group: " +
  "incremental = (spend per B recipient - spend per A recipient) x B recipients.";

type Segment = "all" | "vip" | "dormant_30" | "dormant_60";

async function audience(tenantId: string, segment: Segment) {
  const c = await db();
  let q = c.from("customers").select("id, phone, name").eq("tenant_id", tenantId);
  if (segment === "vip") q = q.eq("is_vip", true);
  if (segment === "dormant_30" || segment === "dormant_60") {
    const days = segment === "dormant_30" ? 30 : 60;
    q = q.not("last_visit_at", "is", null)
      .lt("last_visit_at", new Date(Date.now() - days * 86_400_000).toISOString());
  }
  const { data } = await q.limit(2000);
  return (data ?? []) as Array<{ id: string; phone: string; name: string | null }>;
}

export async function launchCampaign(tenantId: string, campaignId: string) {
  const c = await db();
  const { data: campaign } = await c.from("campaigns")
    .select("id, segment, message_a, message_b, status")
    .eq("tenant_id", tenantId).eq("id", campaignId).maybeSingle();
  if (!campaign) return { ok: false as const, error: "Campaign not found." };
  if (campaign.status !== "draft") return { ok: false as const, error: "This campaign has already been launched." };

  const guests = await audience(tenantId, campaign.segment as Segment);
  if (guests.length === 0) return { ok: false as const, error: "No guests match this segment yet." };

  let queued = 0;
  let held = 0;
  for (const g of guests) {
    const variant = assignVariant(g.phone, Boolean(campaign.message_b));
    const text = variant === "a" ? campaign.message_a : (campaign.message_b as string);
    const r = await enqueueOutbox({
      tenantId,
      phone: g.phone,
      text,
      automated: true,
      dedupeKey: "campaign:" + campaign.id + ":" + g.id,
      campaignId: campaign.id,
      variant,
    });
    if (r.queued) queued += 1;
    if (r.approvalRequired) held += 1;
  }

  await c.from("campaigns").update({ status: "queued", sent_at: null }).eq("tenant_id", tenantId).eq("id", campaignId);
  return { ok: true as const, audience: guests.length, queued, heldForApproval: held };
}

export type CampaignSummary = {
  id: string;
  name: string;
  segment: Segment;
  messageA: string;
  messageB: string | null;
  status: "draft" | "queued" | "sent";
  sentAt: string | null;
  createdAt: string;
  sentCount: number;
  bookings: number;
  revenueCents: number;
  variantB: { sentCount: number; bookings: number; revenueCents: number } | undefined;
  /** Spec section 17: kinds reported separately, never one mixed total. */
  measurement: {
    linkedRevenueCents: number;
    attributionRule: string;
    incrementalRevenueCents: number | null;
    baselineRule: string | null;
  };
};

async function attribution(tenantId: string, campaignId: string, sentAt: string) {
  const c = await db();
  const windowEnd = new Date(new Date(sentAt).getTime() + ATTRIBUTION_WINDOW_DAYS * 86_400_000).toISOString();

  const { data: jobs } = await c.from("outbox_jobs")
    .select("recipient_phone, variant").eq("campaign_id", campaignId).eq("status", "sent");
  const recipients = jobs ?? [];
  if (recipients.length === 0)
    return { total: zero(), a: zero(), b: undefined as CampaignSummary["variantB"] };

  const phones = [...new Set(recipients.map((r) => r.recipient_phone as string))];
  const { data: custs } = await c.from("customers").select("id, phone")
    .eq("tenant_id", tenantId).in("phone", phones);
  const idByPhone = new Map((custs ?? []).map((row) => [row.phone as string, row.id as string]));

  const { data: bookings } = await c.from("reservations").select("customer_phone")
    .eq("tenant_id", tenantId).in("customer_phone", phones)
    .neq("status", "cancelled").gte("created_at", sentAt).lte("created_at", windowEnd);

  const customerIds = [...idByPhone.values()];
  const { data: ledger } = customerIds.length
    ? await c.from("loyalty_ledger").select("customer_id, metadata")
        .eq("tenant_id", tenantId).eq("reason", "visit_earn")
        .in("customer_id", customerIds).gte("created_at", sentAt).lte("created_at", windowEnd)
    : { data: [] };

  const phoneByCustomer = new Map([...idByPhone.entries()].map(([phone, id]) => [id, phone]));
  const revenueByPhone = new Map<string, number>();
  for (const row of ledger ?? []) {
    const phone = phoneByCustomer.get(row.customer_id as string);
    const spend = Number((row.metadata as { spend_cents?: number } | null)?.spend_cents ?? 0);
    if (phone) revenueByPhone.set(phone, (revenueByPhone.get(phone) ?? 0) + spend);
  }
  const bookingsByPhone = new Map<string, number>();
  for (const b of bookings ?? []) {
    const p = b.customer_phone as string;
    bookingsByPhone.set(p, (bookingsByPhone.get(p) ?? 0) + 1);
  }

  const rollUp = (phoneSet: Set<string>) => ({
    sentCount: phoneSet.size,
    bookings: [...phoneSet].reduce((s, p) => s + (bookingsByPhone.get(p) ?? 0), 0),
    revenueCents: [...phoneSet].reduce((s, p) => s + (revenueByPhone.get(p) ?? 0), 0),
  });

  const hasB = recipients.some((r) => r.variant === "b");
  const total = rollUp(new Set(phones));
  const a = rollUp(new Set(recipients.filter((r) => r.variant !== "b").map((r) => r.recipient_phone as string)));
  const b = hasB ? rollUp(new Set(recipients.filter((r) => r.variant === "b").map((r) => r.recipient_phone as string))) : undefined;
  return { total, a, b };
}

const zero = () => ({ sentCount: 0, bookings: 0, revenueCents: 0 });

export async function listCampaignsWithAttribution(tenantId: string): Promise<CampaignSummary[]> {
  const c = await db();
  const { data: rows } = await c.from("campaigns").select("*")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50);

  const out: CampaignSummary[] = [];
  for (const r of rows ?? []) {
    const sent = r.status === "sent" && r.sent_at
      ? await attribution(tenantId, r.id, r.sent_at as string)
      : { total: zero(), a: zero(), b: undefined };
    // Incremental needs a comparison group: only measurable when the campaign
    // ran an A/B test with sends on both arms.
    let incrementalRevenueCents: number | null = null;
    if (sent.b && sent.a.sentCount > 0 && sent.b.sentCount > 0) {
      const perA = sent.a.revenueCents / sent.a.sentCount;
      const perB = sent.b.revenueCents / sent.b.sentCount;
      incrementalRevenueCents = Math.round((perB - perA) * sent.b.sentCount);
    }
    out.push({
      id: r.id,
      name: r.name,
      segment: r.segment,
      messageA: r.message_a,
      messageB: r.message_b,
      status: r.status,
      sentAt: r.sent_at,
      createdAt: r.created_at,
      sentCount: sent.total.sentCount,
      bookings: sent.total.bookings,
      revenueCents: sent.total.revenueCents,
      variantB: sent.b,
      measurement: {
        linkedRevenueCents: sent.total.revenueCents,
        attributionRule: CAMPAIGN_ATTRIBUTION_RULE,
        incrementalRevenueCents,
        baselineRule: incrementalRevenueCents === null ? null : CAMPAIGN_BASELINE_RULE,
      },
    });
  }
  return out;
}

export async function audienceSize(tenantId: string, segment: Segment): Promise<number> {
  return (await audience(tenantId, segment)).length;
}
