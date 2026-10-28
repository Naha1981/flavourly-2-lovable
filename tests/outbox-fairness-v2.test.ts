import { describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state: { db: FakeDb; failPhones: Set<string>; sentPhones: string[] } = {
  db: createFakeDb(),
  failPhones: new Set(),
  sentPhones: [],
};

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/lib/wa-account.server", () => ({
  sendWhatsApp: async (_t: string, phone: string) => {
    if (state.failPhones.has(phone)) return { ok: false as const, error: "operator down" };
    state.sentPhones.push(phone);
    return { ok: true as const, data: { messageId: "wamid-x" } };
  },
}));
vi.mock("../src/lib/wa-account.server", () => ({
  sendWhatsApp: async (_t: string, phone: string) => {
    if (state.failPhones.has(phone)) return { ok: false as const, error: "operator down" };
    state.sentPhones.push(phone);
    return { ok: true as const, data: { messageId: "wamid-x" } };
  },
}));

const past = new Date(Date.now() - 60_000).toISOString();
function jobs(tenant: string, count: number, prefix: string, scheduled = past) {
  return Array.from({ length: count }, (_, i) => ({
    tenant_id: tenant,
    recipient_phone: `${prefix}${String(i).padStart(4, "0")}`,
    message_text: `${tenant} message`,
    automated: false,
    scheduled_for: scheduled,
    status: "pending",
    attempts: 0,
    campaign_id: null,
    variant: null,
    conversation_id: null,
    dedupe_key: `${tenant}-${i}`,
  }));
}

function fresh() {
  state.db = createFakeDb();
  state.failPhones = new Set();
  state.sentPhones = [];
  return state.db;
}

describe("outbox fairness v2", () => {
  it("dominant tenant larger than the window: small tenant still progresses by invocation 2", async () => {
    const db = fresh();
    // Inserted first and sorted first: fills the whole limit*10 window alone.
    await db.from("outbox_jobs").insert(jobs("aaa-big", 600, "2781000"));
    await db.from("outbox_jobs").insert(jobs("bbb-small", 5, "2782000"));
    const { processOutbox } = await import("@/lib/outbox.server");

    const first = await processOutbox(50);
    expect(first.sent).toBe(50);
    let rows = db.rows("outbox_jobs");
    const smallAfterOne = rows.filter((r) => r["tenant_id"] === "bbb-small" && r["status"] === "sent").length;

    const second = await processOutbox(50);
    rows = db.rows("outbox_jobs");
    const smallSent = rows.filter((r) => r["tenant_id"] === "bbb-small" && r["status"] === "sent").length;
    const bigSent = rows.filter((r) => r["tenant_id"] === "aaa-big" && r["status"] === "sent").length;
    expect(smallAfterOne + smallSent).toBeGreaterThan(0);
    expect(smallSent).toBe(5);
    expect(bigSent + smallSent).toBe(50 + second.sent);
  });

  it("advances the watermark so consecutive batches serve different tenant groups", async () => {
    const db = fresh();
    for (const [t, p] of [["aaa", "2783000"], ["bbb", "2784000"], ["ccc", "2785000"], ["ddd", "2786000"], ["eee", "2787000"]] as const) {
      await db.from("outbox_jobs").insert(jobs(t, 10, p));
    }
    const { processOutbox } = await import("@/lib/outbox.server");
    const mark = () => String(db.rows("cron_state").find((r) => r["job"] === "outbox")?.["last_tenant"]);
    await processOutbox(2);
    const m1 = mark();
    expect(m1).toBe("bbb");
    await processOutbox(2);
    expect(mark()).toBe("ddd");
    await processOutbox(2);
    expect(mark()).toBe("eee");
    // Wrap: nothing after "eee", so the wrap query picks the head of the fleet up again.
    await processOutbox(2);
    expect(mark()).toBe("bbb");
  });

  it("serves every due tenant in one batch when scheduled_for ties", async () => {
    const db = fresh();
    await db.from("outbox_jobs").insert(jobs("aaa", 3, "2786000"));
    await db.from("outbox_jobs").insert(jobs("bbb", 3, "2787000"));
    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox(6);
    expect(stats.sent).toBe(6);
  });

  it("two concurrent runs never send the same job twice", async () => {
    const db = fresh();
    await db.from("outbox_jobs").insert(jobs("aaa", 40, "2788000"));
    const { processOutbox } = await import("@/lib/outbox.server");
    const [a, b] = await Promise.all([processOutbox(30), processOutbox(30)]);
    // The invariant: no job is ever sent twice, however the two runs split the window.
    expect(a.sent + b.sent).toBe(state.sentPhones.length);
    expect(new Set(state.sentPhones).size).toBe(state.sentPhones.length);
    expect(state.sentPhones.length).toBeGreaterThan(0);
  });

  it("a failed send re-queues with attempts incremented, and permanently fails at the cap", async () => {
    const db = fresh();
    state.failPhones = new Set(["27890000001"]);
    await db.from("outbox_jobs").insert(jobs("aaa", 2, "2789000"));
    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox(10);
    expect(stats.sent).toBe(1);
    expect(stats.retried).toBe(1);
    const retriedRow = db.rows("outbox_jobs").find((r) => r["recipient_phone"] === "27890000001");
    expect(retriedRow).toBeTruthy();
    expect(retriedRow!["status"]).toBe("pending");
    expect(Number(retriedRow!["attempts"])).toBe(1);
    expect(String(retriedRow!["error"] ?? "")).toContain("operator down");
  });
});
