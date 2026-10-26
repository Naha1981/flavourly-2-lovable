import { describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state: { db: FakeDb } = { db: createFakeDb() };

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/lib/wa-account.server", () => ({
  sendWhatsApp: async () => ({ ok: true as const, data: { messageId: "wamid-x" } }),
  resolveWaAccountId: async () => "wa-1",
  sendDrafterReply: async () => ({ ok: true as const }),
}));
vi.mock("../src/lib/wa-account.server", () => ({
  sendWhatsApp: async () => ({ ok: true as const, data: { messageId: "wamid-x" } }),
  resolveWaAccountId: async () => "wa-1",
  sendDrafterReply: async () => ({ ok: true as const }),
}));

describe("processOutbox tenant fairness", () => {
  it("a flooded tenant cannot starve other tenants out of a batch", async () => {
    const db = createFakeDb();
    state.db = db;
    const past = new Date(Date.now() - 60_000).toISOString();
    const big = Array.from({ length: 40 }, (_, i) => ({
      tenant_id: "big-co",
      recipient_phone: `2782000${String(i).padStart(4, "0")}`,
      message_text: "big-co message",
      automated: false,
      scheduled_for: past,
      status: "pending",
      attempts: 0,
      campaign_id: null,
      variant: null,
      conversation_id: null,
      dedupe_key: `big-${i}`,
    }));
    const small = Array.from({ length: 5 }, (_, i) => ({
      tenant_id: "small-bistro",
      recipient_phone: `2783000${String(i).padStart(4, "0")}`,
      message_text: "small-bistro message",
      automated: false,
      scheduled_for: past,
      status: "pending",
      attempts: 0,
      campaign_id: null,
      variant: null,
      conversation_id: null,
      dedupe_key: `small-${i}`,
    }));
    await db.from("outbox_jobs").insert([...big, ...small]);

    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox(10);
    expect(stats.sent).toBe(10);

    const rows = db.rows("outbox_jobs");
    const smallSent = rows.filter((r) => r["tenant_id"] === "small-bistro" && r["status"] === "sent");
    expect(smallSent.length).toBeGreaterThanOrEqual(2);
  });
});
