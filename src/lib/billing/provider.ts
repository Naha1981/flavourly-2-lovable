export type PlanTier = "starter" | "casual" | "premium" | "signature" | "group";

export const PLAN_TIERS: PlanTier[] = ["starter", "casual", "premium", "signature", "group"];

export const TIER_MONTHLY_CENTS: Record<PlanTier, number> = {
  starter: 49_900,
  casual: 149_900,
  premium: 399_900,
  signature: 799_900,
  group: 1_999_900,
};

export const TIER_MONTHLY_MESSAGES: Record<PlanTier, number> = {
  starter: 500,
  casual: 2_000,
  premium: 10_000,
  signature: 50_000,
  group: Infinity,
};

export const TIER_HOURLY_MESSAGES: Record<PlanTier, number> = {
  starter: 100,
  casual: 250,
  premium: 500,
  signature: 1_000,
  group: 2_000,
};

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_TIERS.includes(value as PlanTier);
}

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled";

export function canUseService(
  status: BillingStatus,
  trialEndsAt: string | null,
  now = new Date(),
): boolean {
  if (status === "active") return true;
  if (status !== "trialing") return false;
  return Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime());
}

export function quotaDecision(
  tier: PlanTier,
  usage: { monthlyReserved: number; hourlyReserved: number },
) {
  const monthly = TIER_MONTHLY_MESSAGES[tier];
  const hourly = TIER_HOURLY_MESSAGES[tier];
  if (monthly !== Infinity && usage.monthlyReserved >= monthly) {
    return {
      allowed: false as const,
      reason: "monthly_quota_exceeded" as const,
      limit: monthly,
      used: usage.monthlyReserved,
    };
  }
  if (usage.hourlyReserved >= hourly) {
    return {
      allowed: false as const,
      reason: "hourly_rate_exceeded" as const,
      limit: hourly,
      used: usage.hourlyReserved,
    };
  }
  return { allowed: true as const };
}
