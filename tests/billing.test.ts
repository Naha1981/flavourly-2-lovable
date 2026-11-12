import { describe, expect, it } from "vitest";

import { canUseService, quotaDecision } from "@/lib/billing/provider";

describe("billing gates", () => {
  it("allows an active subscription", () => {
    expect(canUseService("active", null)).toBe(true);
  });

  it("allows a current trial but not an expired one", () => {
    expect(canUseService("trialing", new Date(Date.now() + 86_400_000).toISOString())).toBe(true);
    expect(canUseService("trialing", new Date(Date.now() - 1).toISOString())).toBe(false);
  });

  it("blocks canceled and past-due accounts", () => {
    expect(canUseService("canceled", null)).toBe(false);
    expect(canUseService("past_due", null)).toBe(false);
  });

  it("enforces monthly and hourly message limits", () => {
    expect(quotaDecision("starter", { monthlyReserved: 499, hourlyReserved: 0 }).allowed).toBe(true);
    expect(quotaDecision("starter", { monthlyReserved: 500, hourlyReserved: 0 }).reason).toBe("monthly_quota_exceeded");
    expect(quotaDecision("starter", { monthlyReserved: 10, hourlyReserved: 100 }).reason).toBe("hourly_rate_exceeded");
  });
});
