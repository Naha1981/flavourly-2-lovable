import { describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state: { db: FakeDb; sent: string[] } = { db: createFakeDb(), sent: [] };

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
const send = async (_tenant: string, phone: string) => {
  state.sent.push(phone);
  return { ok: true as const, data: { messageId: "wamid-1" } };
};
vi.mock("@/lib/wa-account.server", () => ({ sendWhatsApp: send }));
vi.mock("../src/lib/wa-account.server", () => ({ sendWhatsApp: send }));

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function job(overrides: Record<string, unknown>) {
  return {
    tenant_id: "marble-jhb",
    recipient_phone: "27820000001",
    message_text: "hello",
    automated: false,
    scheduled_for: minutesAgo(30),
    status: "pending",
    attempts: 0,
    campaign_id: null,
    variant: null,
    conversation_id: null,
    dedupe_key: "k-" + Math.random(),
    ...overrides,
  };
}

describe("outbox crash recovery", () => {
  it("marks a job abandoned mid-send as failed (not re-sent, not stuck forever)", async () => {
    state.db = createFakeDb();
    state.sent = [];
    await state.db.from("outbox_jobs").insert(job({ recipient_phone: "27820000009", status: "processing", claimed_at: minutesAgo(20) }));
    const { processOutbox } = await import("@/lib/outbox.server");

    await processOutbox(50);

    const [row] = state.db.rows("outbox_jobs");
    expect(row?.["status"]).toBe("failed");
    expect(String(row?.["error"])).toMatch(/duplicate message/);
    expect(state.sent).toEqual([]);
  });

  it("leaves a recently claimed job alone (another run may still be sending it)", async () => {
    state.db = createFakeDb();
    state.sent = [];
    await state.db.from("outbox_jobs").insert(job({ status: "processing", claimed_at: minutesAgo(2) }));
    const { processOutbox } = await import("@/lib/outbox.server");

    await processOutbox(50);

    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("processing");
  });

  it("stamps claimed_at when it claims a job, then completes it as sent", async () => {
    state.db = createFakeDb();
    state.sent = [];
    await state.db.from("outbox_jobs").insert(job({ recipient_phone: "27820000002" }));
    const { processOutbox } = await import("@/lib/outbox.server");

    const stats = await processOutbox(50);

    expect(stats.sent).toBe(1);
    const [row] = state.db.rows("outbox_jobs");
    expect(row?.["status"]).toBe("sent");
    expect(typeof row?.["claimed_at"]).toBe("string");
    expect(state.sent).toEqual(["27820000002"]);
  });
});
