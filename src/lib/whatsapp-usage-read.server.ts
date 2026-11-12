import type { ReplyUsage } from "./whatsapp-usage.functions";
import { db } from "./db.server";
import { replyUsageErrorReference } from "./whatsapp-usage-diagnostic.server";

export function usageWindowStarts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (key: string) => Number(parts.find((p) => p.type === key)?.value);
  return {
    month: new Date(Date.UTC(part("year"), part("month") - 1, 1, -2)).toISOString(),
    day: new Date(Date.UTC(part("year"), part("month") - 1, part("day"), -2)).toISOString(),
    hour: new Date(now.getTime() - 3600000).toISOString(),
  };
}

type Profile = { plan_tier: string; plan_status: string; trial_ends_at: string | null };
type Counts = { monthly: number; daily: number; hourly: number; trial: number };
export function calculateReplyUsage(
  profile: Profile | null,
  counts: Counts,
  now: Date,
): ReplyUsage {
  if (!profile) return { allowed: false, reason: "profile_missing" };
  const monthlyLimit =
    ({ starter: 500, casual: 1000, premium: 2500 } as Record<string, number>)[profile.plan_tier] ??
    0;
  let reason: string | null = null;
  if (!["active", "trialing"].includes(profile.plan_status)) reason = "subscription_inactive";
  else if (
    profile.plan_status === "trialing" &&
    (!profile.trial_ends_at ||
      Date.parse(profile.trial_ends_at) <= now.getTime() ||
      !Number.isFinite(Date.parse(profile.trial_ends_at)))
  )
    reason = "trial_expired";
  else if (!monthlyLimit) reason = "plan_not_supported";
  else if (counts.monthly >= monthlyLimit) reason = "monthly_limit";
  else if (profile.plan_status === "trialing" && counts.trial >= 100) reason = "trial_limit";
  else if (counts.daily >= 25) reason = "pilot_daily_limit";
  else if (counts.hourly >= 60) reason = "hourly_limit";
  return {
    allowed: reason === null,
    reason,
    monthlyUsed: counts.monthly,
    monthlyLimit,
    dailyUsed: counts.daily,
    dailyLimit: 25,
    trialUsed: counts.trial,
    trialLimit: profile.plan_status === "trialing" ? 100 : null,
  };
}

/** Display-only read. Reservation/sending enforcement remains in wa_reserve_budget. */
export async function readReplyUsage(tenantId: string): Promise<ReplyUsage> {
  const client = await db();
  const now = new Date();
  const starts = usageWindowStarts(now);
  const profile = await client
    .from("tenant_profiles")
    .select("plan_tier,plan_status,trial_ends_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (profile.error)
    throw new Error(
      `Reply usage could not be checked. Sending stays paused. Reference: ${replyUsageErrorReference(profile.error)}`,
    );
  if (!profile.data) return { allowed: false, reason: "profile_missing" };
  const base = () =>
    client
      .from("wa_budget_uses")
      .select("tenant_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("kind", "send");
  const results = await Promise.all([
    base().gte("used_at", starts.month),
    base().gte("used_at", starts.day),
    base().gt("used_at", starts.hour),
    base(),
  ]);
  for (const result of results) {
    if (result.error || result.count == null)
      throw new Error(
        `Reply usage could not be checked. Sending stays paused. Reference: ${replyUsageErrorReference(result.error)}`,
      );
  }
  return calculateReplyUsage(
    profile.data,
    {
      monthly: results[0].count!,
      daily: results[1].count!,
      hourly: results[2].count!,
      trial: results[3].count!,
    },
    now,
  );
}
