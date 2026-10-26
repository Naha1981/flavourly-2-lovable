import { describe, expect, it, vi, type Mock } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

type SendMock = Mock<(...args: unknown[]) => Promise<unknown>>;
const state: {
  db: FakeDb;
  sendText: SendMock;
  bootstrap: SendMock;
  billed: string[];
} = {
  db: createFakeDb(),
  sendText: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  bootstrap: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  billed: [],
};

vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/lib/whatsapp.server", () => ({
  sendText: (...a: unknown[]) => state.sendText(...a),
  bootstrap: (...a: unknown[]) => state.bootstrap(...a),
}));
vi.mock("@/lib/billing.server", () => ({
  assertCanSendNow: async (tenantId: string) => {
    state.billed.push(tenantId);
  },
}));

const TENANT = "marble-jhb";

function fresh() {
  state.sendText = vi.fn(async () => ({ ok: true as const, data: { messageId: "wamid-1" } }));
  state.bootstrap = vi.fn(async () => ({ ok: true as const, data: { waAccountId: "wa-bootstrapped" } }));
  state.billed = [];
  const db = createFakeDb();
  state.db = db;
  return db;
}

async function seed(db: FakeDb) {
  await db
    .from("tenant_profiles")
    .insert({ tenant_id: TENANT, name: "Marble", wa_account_id: "wa-1" });
}

describe("sendDrafterReply safeguards", () => {
  it("sends through the tenant-bound account and writes an audit row", async () => {
    const db = fresh();
    await seed(db);
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-1", "+27112223333", "See you at 7!");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.auditRecorded).toBe(true);
    expect(state.billed).toEqual([TENANT]);
    expect(state.sendText).toHaveBeenCalledTimes(1);
    expect(state.sendText.mock.calls[0]).toEqual([TENANT, "wa-1", "27112223333", "See you at 7!"]);
    const rows = await db.from("outbox_jobs").select();
    expect(rows.data).toHaveLength(1);
    const job = (rows.data as Record<string, unknown>[])[0]!;
    expect(job["status"]).toBe("sent");
    expect(job["automated"]).toBe(false);
    expect(job["recipient_phone"]).toBe("27112223333");
  });

  it("refuses a client-supplied account id that is not the tenant's bound account", async () => {
    const db = fresh();
    await seed(db);
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-OTHER-TENANT", "+27112223333", "hi");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/does not belong/);
    expect(state.sendText).not.toHaveBeenCalled();
  });

  it("refuses opted-out guests and never sends", async () => {
    const db = fresh();
    await seed(db);
    await db.from("wa_opt_outs").insert({ tenant_id: TENANT, phone: "27112223333" });
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-1", "+27112223333", "hi");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/opted out/);
    expect(state.sendText).not.toHaveBeenCalled();
  });

  it("ignores a foreign account hint when the tenant has no bound account", async () => {
    const db = fresh();
    await db.from("tenant_profiles").insert({ tenant_id: TENANT, name: "Marble", wa_account_id: null });
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-FOREIGN", "+27112223333", "hi");
    expect(res.ok).toBe(true);
    expect(state.sendText).toHaveBeenCalledTimes(1);
    expect(state.sendText.mock.calls[0]?.[1]).toBe("wa-bootstrapped");
    expect(state.sendText.mock.calls[0]?.[1]).not.toBe("wa-FOREIGN");
    const rows = await db.from("tenant_profiles").select();
    expect((rows.data as Record<string, unknown>[])[0]?.["wa_account_id"]).toBe("wa-bootstrapped");
  });

  it("fails closed when the account binding lookup errors", async () => {
    const db = fresh();
    await seed(db);
    db.injectError("tenant_profiles", "select", { code: "500", message: "db down" });
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-1", "+27112223333", "hi");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Could not verify/);
    expect(state.sendText).not.toHaveBeenCalled();
  });

  it("still reports success when the audit write fails after a successful send", async () => {
    const db = fresh();
    await seed(db);
    db.injectError("outbox_jobs", "insert", { code: "500", message: "audit db down" });
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-1", "+27112223333", "hi");
    expect(res.ok).toBe(true);
    expect(state.sendText).toHaveBeenCalledTimes(1);
    if (res.ok) expect(res.auditRecorded).toBe(false);
  });

  it("does not write an audit row when the operator send fails", async () => {
    const db = fresh();
    await seed(db);
    state.sendText = vi.fn(async () => ({ ok: false as const, error: "operator down" }));
    const { sendDrafterReply } = await import("@/lib/wa-account.server");
    const res = await sendDrafterReply(TENANT, "wa-1", "+27112223333", "hi");
    expect(res.ok).toBe(false);
    const rows = await db.from("outbox_jobs").select();
    expect(rows.data).toHaveLength(0);
  });
});
