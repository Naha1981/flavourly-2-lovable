import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";
import {
  REVENUE_MEASURE_KINDS,
  summarizeMeasures,
  validateMeasure,
} from "../src/lib/revenue-measurement";

/**
 * Spec section 17: observed sales, linked revenue, estimated opportunity,
 * incremental sales and contribution are reported separately. A combined
 * "revenue" number across kinds is the bug this guards against.
 */

describe("revenue measure kinds", () => {
  it("reports the five kinds separately with no combined total", () => {
    const report = summarizeMeasures([
      { kind: "observed_sales", amountCents: 1000, source: "pos" },
      { kind: "linked_revenue", amountCents: 500, source: "campaign", attributionRule: "7-day window" },
      { kind: "estimated_opportunity", amountCents: 9000, source: "revenue_employee" },
    ]);
    expect(Object.keys(report).sort()).toEqual([...REVENUE_MEASURE_KINDS].sort());
    expect(report.observed_sales).toBe(1000);
    expect(report.linked_revenue).toBe(500);
    expect(report.estimated_opportunity).toBe(9000);
    expect(report.incremental_sales).toBe(0);
    expect(report.contribution).toBe(0);
    expect((report as Record<string, unknown>)["total"]).toBeUndefined();
  });

  it("accumulates within a kind", () => {
    const report = summarizeMeasures([
      { kind: "observed_sales", amountCents: 100, source: "a" },
      { kind: "observed_sales", amountCents: 250, source: "b" },
    ]);
    expect(report.observed_sales).toBe(350);
  });

  it("refuses linked or incremental measures without a stated rule", () => {
    expect(() =>
      summarizeMeasures([{ kind: "linked_revenue", amountCents: 1, source: "x" }]),
    ).toThrow(/attribution rule/);
    expect(() =>
      validateMeasure({ kind: "incremental_sales", amountCents: 1, source: "x", attributionRule: "r" }),
    ).toThrow(/baseline/);
    expect(
      validateMeasure({
        kind: "incremental_sales",
        amountCents: 1,
        source: "x",
        attributionRule: "r",
        baselineRule: "b",
      }).kind,
    ).toBe("incremental_sales");
    expect(validateMeasure({ kind: "observed_sales", amountCents: 1, source: "x" }).kind)
      .toBe("observed_sales");
  });
});

const state: { db: FakeDb } = { db: createFakeDb() };

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() { return state.db; },
}));

describe("campaign revenue measurement", () => {
  const TENANT = "marble-jhb";

  beforeEach(() => {
    state.db = createFakeDb();
  });

  async function seedCampaign(opts: { ab: boolean }) {
    const sentAt = new Date(Date.now() - 60_000).toISOString();
    await state.db.from("campaigns").insert({
      id: "c1", tenant_id: TENANT, name: "Quiet Sunday", segment: "all",
      message_a: "Come in Sunday", message_b: opts.ab ? "Sunday special" : null,
      status: "sent", sent_at: sentAt,
    });
    const jobs = [
      { recipient_phone: "27820000001", variant: "a" },
      { recipient_phone: "27820000002", variant: "a" },
      ...(opts.ab
        ? [
            { recipient_phone: "27820000003", variant: "b" },
            { recipient_phone: "27820000004", variant: "b" },
          ]
        : []),
    ];
    for (const j of jobs)
      await state.db.from("outbox_jobs").insert({
        tenant_id: TENANT, campaign_id: "c1", status: "sent",
        recipient_phone: j.recipient_phone, variant: j.variant,
      });
    // A recipients spent R10 each, B recipients spent R30 each, inside the window.
    const spend: Record<string, number> = {
      "27820000001": 1000, "27820000002": 1000,
      "27820000003": 3000, "27820000004": 3000,
    };
    for (const [phone, cents] of Object.entries(spend)) {
      if (!opts.ab && phone > "27820000002") continue;
      await state.db.from("customers").insert({ id: "cust-" + phone, tenant_id: TENANT, phone });
      await state.db.from("loyalty_ledger").insert({
        tenant_id: TENANT, customer_id: "cust-" + phone, reason: "visit_earn",
        metadata: { spend_cents: cents }, created_at: new Date().toISOString(),
      });
    }
    return sentAt;
  }

  it("labels campaign revenue as linked and measures incremental lift vs variant A", async () => {
    await seedCampaign({ ab: true });
    const { listCampaignsWithAttribution } = await import("@/lib/campaigns.server");
    const [c] = await listCampaignsWithAttribution(TENANT);
    expect(c.revenueCents).toBe(8000);
    expect(c.measurement.linkedRevenueCents).toBe(c.revenueCents);
    expect(c.measurement.attributionRule).toContain("7 days");
    // (R30 - R10) x 2 B recipients = R40 lift.
    expect(c.measurement.incrementalRevenueCents).toBe(4000);
    expect(c.measurement.baselineRule).toContain("Variant A");
  });

  it("reports no incremental figure when there is no comparison group", async () => {
    await seedCampaign({ ab: false });
    const { listCampaignsWithAttribution } = await import("@/lib/campaigns.server");
    const [c] = await listCampaignsWithAttribution(TENANT);
    expect(c.measurement.linkedRevenueCents).toBe(2000);
    expect(c.measurement.incrementalRevenueCents).toBeNull();
    expect(c.measurement.baselineRule).toBeNull();
  });
});

describe("menu matrix revenue labelling", () => {
  it("labels 30d item revenue as observed sales without changing totals", async () => {
    const { classifyMenu } = await import("../src/lib/menu-matrix");
    const summary = classifyMenu([
      { id: "1", name: "Burger", priceCents: 12000, costPriceCents: 4000, salesCount30d: 10, isAvailable: true },
    ]);
    expect(summary.revenueMeasureKind).toBe("observed_sales");
    expect(summary.revenueCents30d).toBe(120000);
  });
});
