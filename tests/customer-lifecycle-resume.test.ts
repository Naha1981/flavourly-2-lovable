import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state: { db: FakeDb; attempted: string[] } = { db: createFakeDb(), attempted: [] };

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/lib/outbox.server", () => ({
  enqueueOutbox: async (input: { tenantId: string }) => {
    state.attempted.push(input.tenantId);
    if (input.tenantId === "bbb-bad") throw new Error("tenant boom");
    return { queued: true, approvalRequired: false };
  },
}));
vi.mock("../src/lib/outbox.server", () => ({
  enqueueOutbox: async (input: { tenantId: string }) => {
    state.attempted.push(input.tenantId);
    if (input.tenantId === "bbb-bad") throw new Error("tenant boom");
    return { queued: true, approvalRequired: false };
  },
}));

afterEach(() => {
  delete process.env["FLAVOURLY_CRON_MAX_TENANTS_PER_RUN"];
});

describe("runCustomerLifecycle resumability", () => {
  it("covers every tenant across bounded invocations, isolates a failing tenant", async () => {
    const db = createFakeDb();
    state.db = db;
    state.attempted = [];
    const today = new Date();
    const birthday = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    for (const t of ["aaa", "bbb-bad", "ccc", "ddd", "eee"]) {
      await db.from("tenant_profiles").insert({ tenant_id: t, name: t });
      await db.from("customers").insert({
        tenant_id: t, phone: "27820000001", name: "Guest", birthday,
        last_visit_at: today.toISOString(),
        last_birthday_reward_sent_at: null, last_reactivation_sent_at: null,
      });
    }
    process.env["FLAVOURLY_CRON_MAX_TENANTS_PER_RUN"] = "2";
    const { runCustomerLifecycle } = await import("@/lib/customer-lifecycle.server");

    const r1 = await runCustomerLifecycle();
    expect(r1.tenants).toBe(2);
    expect(r1.failed).toBe(1); // bbb-bad isolated
    expect(r1.birthdays).toBe(1); // aaa still processed
    const mark = () => String(db.rows("cron_state").find((r) => r["job"] === "customer-lifecycle")?.["last_tenant"]);
    expect(mark()).toBe("bbb-bad");

    const r2 = await runCustomerLifecycle();
    expect(mark()).toBe("ddd");
    expect(r2.failed).toBe(0);

    const r3 = await runCustomerLifecycle();
    expect(mark()).toBe("aaa"); // wrapped: eee then aaa

    const covered = new Set(state.attempted);
    expect(covered).toEqual(new Set(["aaa", "bbb-bad", "ccc", "ddd", "eee"]));

    // The failing tenant is retried on a later cycle, not hammered every run.
    expect(state.attempted.filter((t) => t === "bbb-bad").length).toBe(1);
  });
});
