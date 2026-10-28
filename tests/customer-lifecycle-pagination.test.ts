import { describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state: { db: FakeDb } = { db: createFakeDb() };

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/lib/outbox.server", () => ({
  enqueueOutbox: async () => ({ queued: true, approvalRequired: false }),
}));
vi.mock("../src/lib/outbox.server", () => ({
  enqueueOutbox: async () => ({ queued: true, approvalRequired: false }),
}));

describe("runCustomerLifecycle at fleet scale", () => {
  it("processes every customer past the old 5,000 cap", async () => {
    const db = createFakeDb();
    state.db = db;
    await db.from("tenant_profiles").insert({ tenant_id: "marble-jhb", name: "Marble" });
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const birthday = `${mm}-${dd}`;
    const rows = Array.from({ length: 5_500 }, (_, i) => ({
      tenant_id: "marble-jhb",
      phone: `2782000${String(i).padStart(4, "0")}`,
      name: `Guest ${i}`,
      birthday,
      last_visit_at: today.toISOString(),
      last_birthday_reward_sent_at: null,
      last_reactivation_sent_at: null,
    }));
    await db.from("customers").insert(rows);

    const { runCustomerLifecycle } = await import("@/lib/customer-lifecycle.server");
    const totals = await runCustomerLifecycle();
    expect(totals.tenants).toBe(1);
    expect(totals.birthdays).toBe(5_500);
    expect(totals.remaining).toBe(0);
  });
});
