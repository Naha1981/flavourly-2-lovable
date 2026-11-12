import { describe, expect, it } from "vitest";

import { quotaTelemetryEvents } from "@/lib/billing/provider";

describe("quota telemetry thresholds", () => {
  it("stays quiet below 80% of both budgets", () => {
    expect(
      quotaTelemetryEvents("starter", { monthlyReserved: 399, hourlyReserved: 79 }),
    ).toEqual([]);
  });

  it("warns at 80% of the monthly budget", () => {
    const events = quotaTelemetryEvents("starter", { monthlyReserved: 400, hourlyReserved: 0 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: "quota_usage",
      scope: "monthly",
      used: 400,
      limit: 500,
      percent: 80,
      level: "warning",
    });
  });

  it("escalates to critical at 100% of the hourly budget", () => {
    const events = quotaTelemetryEvents("starter", { monthlyReserved: 0, hourlyReserved: 100 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ scope: "hourly", percent: 100, level: "critical" });
  });

  it("never emits a monthly event for the unlimited group tier", () => {
    expect(quotaTelemetryEvents("group", { monthlyReserved: 999_999, hourlyReserved: 0 })).toEqual([]);
  });

  it("can emit both scopes in one check", () => {
    const events = quotaTelemetryEvents("starter", { monthlyReserved: 500, hourlyReserved: 100 });
    expect(events.map((e) => e.scope).sort()).toEqual(["hourly", "monthly"]);
    expect(events.every((e) => e.level === "critical")).toBe(true);
  });
});
