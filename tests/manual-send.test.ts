import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = { assertCanSendNow: vi.fn(), sendWhatsApp: vi.fn(), inserted: [] as Array<Record<string, unknown>>, updated: [] as Array<Record<string, unknown>> };
let conversation: { id: string } | null = null;

function table() {
  const api: Record<string, unknown> = {};
  const self = () => api;
  Object.assign(api, {
    select: self, eq: self, in: self, order: self, limit: self,
    maybeSingle: async () => ({ data: conversation, error: null }),
    insert: async (row: Record<string, unknown>) => { calls.inserted.push(row); return { error: null }; },
    update: (row: Record<string, unknown>) => { calls.updated.push(row); return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
  });
  return api;
}

vi.mock("@/lib/db.server", () => ({ db: async () => ({ from: () => table() }) }));
vi.mock("@/lib/wa-account.server", () => ({ sendWhatsApp: (...args: unknown[]) => calls.sendWhatsApp(...args) }));

async function load() {
  return import("@/lib/manual-send.server");
}

beforeEach(() => {
  conversation = { id: "conv-1" };
  calls.inserted = [];
  calls.updated = [];
  calls.sendWhatsApp.mockReset();
  calls.sendWhatsApp.mockResolvedValue({ ok: true, data: { messageId: "wamid-1" } });
});

describe("sendManualReply", () => {
  it("refuses a number that has never messaged the restaurant, and sends nothing", async () => {
    const { sendManualReply } = await load();
    conversation = null;
    const result = await sendManualReply("the-table", "+27821234567", "hello");
    expect(result.ok).toBe(false);
    expect(calls.sendWhatsApp).not.toHaveBeenCalled();
  });

  it("sends through the gated path without a browser-supplied account, and records the message", async () => {
    const { sendManualReply } = await load();
    const result = await sendManualReply("the-table", "+27 82 123 4567", "Your table is ready");
    expect(result).toEqual({ ok: true, messageId: "wamid-1" });
    expect(calls.sendWhatsApp).toHaveBeenCalledWith("the-table", "27821234567", "Your table is ready");
    expect(calls.inserted[0]).toMatchObject({ conversation_id: "conv-1", tenant_id: "the-table", direction: "out", body: "Your table is ready" });
  });

  it("surfaces billing/quota refusals instead of sending", async () => {
    const { sendManualReply } = await load();
    calls.sendWhatsApp.mockRejectedValue(new Error("Your trial has ended."));
    const result = await sendManualReply("the-table", "27821234567", "hi");
    expect(result).toEqual({ ok: false, error: "Your trial has ended." });
    expect(calls.inserted).toHaveLength(0);
  });

  it("does not record a message when the operator fails", async () => {
    const { sendManualReply } = await load();
    calls.sendWhatsApp.mockResolvedValue({ ok: false, error: "operator down" });
    const result = await sendManualReply("the-table", "27821234567", "hi");
    expect(result.ok).toBe(false);
    expect(calls.inserted).toHaveLength(0);
  });
});
