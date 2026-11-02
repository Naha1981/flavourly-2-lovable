import { describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.client }));
import {
  calculateReplyUsage,
  usageWindowStarts,
  readReplyUsage,
} from "../src/lib/whatsapp-usage-read.server";
const now = new Date("2026-11-01T22:30:00Z");
const profile = {
  plan_tier: "starter",
  plan_status: "trialing",
  trial_ends_at: "2026-11-09T00:00:00Z",
};
const counts = { monthly: 0, daily: 0, hourly: 0, trial: 0 };
describe("display-only reply allowance", () => {
  it("uses South African day/month boundaries", () => {
    expect(usageWindowStarts(now)).toEqual({
      month: "2026-10-31T22:00:00.000Z",
      day: "2026-11-01T22:00:00.000Z",
      hour: "2026-11-01T21:30:00.000Z",
    });
    expect(usageWindowStarts(new Date("2026-12-31T22:30:00Z")).month).toBe(
      "2026-12-31T22:00:00.000Z",
    );
  });
  it("matches the existing read RPC limits", () => {
    expect(calculateReplyUsage(profile, counts, now)).toMatchObject({
      allowed: true,
      monthlyLimit: 500,
      dailyLimit: 25,
      trialLimit: 100,
    });
    expect(
      calculateReplyUsage({ ...profile, plan_tier: "casual", plan_status: "active" }, counts, now),
    ).toMatchObject({ monthlyLimit: 1000, trialLimit: null });
    expect(
      calculateReplyUsage({ ...profile, plan_tier: "premium" }, counts, now).monthlyLimit,
    ).toBe(2500);
  });
  it.each([
    [null, counts, "profile_missing"],
    [{ ...profile, plan_status: "cancelled" }, counts, "subscription_inactive"],
    [{ ...profile, trial_ends_at: null }, counts, "trial_expired"],
    [{ ...profile, trial_ends_at: "bad" }, counts, "trial_expired"],
    [{ ...profile, plan_tier: "growth" }, counts, "plan_not_supported"],
    [profile, { ...counts, monthly: 500 }, "monthly_limit"],
    [profile, { ...counts, trial: 100 }, "trial_limit"],
    [profile, { ...counts, daily: 25 }, "pilot_daily_limit"],
    [profile, { ...counts, hourly: 60 }, "hourly_limit"],
  ])("fails closed for %s", (p, c, reason) => {
    expect(calculateReplyUsage(p as typeof profile, c as typeof counts, now)).toMatchObject({
      allowed: false,
      reason,
    });
  });
});

describe("tenant-scoped database reads", () => {
  function fixture(error: unknown = null, count: number | null = 0) {
    const queries: { table: string; filters: unknown[][] }[] = [];
    state.client = {
      from(table: string) {
        const query = { table, filters: [] as unknown[][] };
        queries.push(query);
        const chain = {
          select(...args: unknown[]) {
            query.filters.push(["select", ...args]);
            return chain;
          },
          eq(...args: unknown[]) {
            query.filters.push(["eq", ...args]);
            return chain;
          },
          gte(...args: unknown[]) {
            query.filters.push(["gte", ...args]);
            return chain;
          },
          gt(...args: unknown[]) {
            query.filters.push(["gt", ...args]);
            return chain;
          },
          maybeSingle: async () => ({
            data: { ...profile, trial_ends_at: "2099-01-01T00:00:00Z" },
            error: null,
          }),
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({ count, error }).then(resolve);
          },
        };
        return chain;
      },
    };
    return queries;
  }
  it("scopes every read to the supplied tenant and counts only reserved sends", async () => {
    const queries = fixture();
    expect(await readReplyUsage("qa-a")).toMatchObject({
      allowed: true,
      monthlyUsed: 0,
      dailyUsed: 0,
    });
    expect(queries).toHaveLength(5);
    for (const q of queries) expect(q.filters).toContainEqual(["eq", "tenant_id", "qa-a"]);
    for (const q of queries.filter((q) => q.table === "wa_budget_uses")) {
      expect(q.filters).toContainEqual(["eq", "kind", "send"]);
      expect(q.filters).toContainEqual(["select", "tenant_id", { count: "exact", head: true }]);
    }
  });
  it("throws rather than substituting zero for a failed or unavailable count", async () => {
    fixture({ code: "42501", message: "private SQL" });
    await expect(readReplyUsage("qa-a")).rejects.toThrow("Reference: 42501");
    fixture(null, null);
    await expect(readReplyUsage("qa-a")).rejects.toThrow("Reference: EMPTY_RESULT");
  });
});
