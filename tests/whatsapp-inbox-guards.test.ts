import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";
const state = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof createFakeDb> }));
vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state.db }));
import { sendText, bootstrap, status } from "@/lib/whatsapp.server";
import { parseInboxEvent } from "@/lib/webhook-ingest.server";
const event = () => ({
  id: "event-1",
  event: "message.received",
  timestamp: new Date().toISOString(),
  account: { accountId: "account-a", profileId: "profile-a", platform: "whatsapp" },
  conversation: { id: "conversation-a" },
  message: { id: "message-a", text: "Menu please", sender: { phoneNumber: "27821234567" } },
});
beforeEach(() => {
  state.db = createFakeDb();
  state.db
    .rows("wa_channels")
    .push({ tenant_id: "venue-a", account_id: "account-a", profile_id: "profile-a" });
  state.db.rows("wa_conversations").push({
    id: "convo-a",
    tenant_id: "venue-a",
    provider_conversation_id: "conversation-a",
    guest_phone: "27821234567",
    last_inbound_at: new Date().toISOString(),
  });
  process.env["WHATSAPP_SEND_ENABLED"] = "true";
  process.env["ZERNIO_API_KEY"] = "test-only-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ message: { id: "reply-1" } })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["WHATSAPP_SEND_ENABLED"];
  delete process.env["ZERNIO_API_KEY"];
});
describe("reply-only send guard", () => {
  it("sends a recent customer reply through the inbox only", async () => {
    expect((await sendText("venue-a", "account-a", "27821234567", "Welcome")).ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://zernio.com/api/v1/inbox/conversations/conversation-a/messages",
      expect.objectContaining({
        body: JSON.stringify({ accountId: "account-a", message: "Welcome" }),
      }),
    );
  });
  for (const scenario of [
    "disabled",
    "foreign-account",
    "foreign-tenant",
    "never-inbound",
    "expired",
    "opted-out",
    "budget-exhausted",
  ])
    it(`refuses ${scenario} without a network call`, async () => {
      if (scenario === "disabled") delete process.env["WHATSAPP_SEND_ENABLED"];
      if (scenario === "never-inbound") state.db.rows("wa_conversations").splice(0);
      if (scenario === "expired")
        state.db.rows("wa_conversations")[0]!["last_inbound_at"] = new Date(
          Date.now() - 86400001,
        ).toISOString();
      if (scenario === "opted-out")
        state.db.rows("wa_opt_outs").push({ tenant_id: "venue-a", phone: "27821234567" });
      if (scenario === "budget-exhausted")
        vi.spyOn(state.db, "rpc").mockResolvedValue({ data: false, error: null });
      const result = await sendText(
        scenario === "foreign-tenant" ? "venue-b" : "venue-a",
        scenario === "foreign-account" ? "account-b" : "account-a",
        "27821234567",
        "hi",
      );
      expect(result.ok).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
      if (scenario === "budget-exhausted")
        expect(state.db.rows("wa_conversations")[0]).toMatchObject({ status: "needs_approval" });
    });
});
describe("provider parser", () => {
  it("ignores provider test deliveries and preserves standby for human control", () => {
    expect(parseInboxEvent({ ...event(), test: true })).toBeNull();
    const e = event();
    expect(
      parseInboxEvent({ ...e, message: { ...e.message, metadata: { standby: true } } })?.standby,
    ).toBe(true);
  });

  it("uses provider account identity and ignores attacker tenant hints", () => {
    expect(parseInboxEvent({ ...event(), tenantId: "venue-b" })?.accountId).toBe("account-a");
    expect(parseInboxEvent({ ...event(), tenantId: "venue-b" })).not.toHaveProperty("tenantId");
  });
  it("rejects echoes, other platforms, missing IDs and malformed timestamps", () => {
    const e = event();
    expect(parseInboxEvent({ ...e, message: { ...e.message, fromMe: true } })).toBeNull();
    expect(parseInboxEvent({ ...e, account: { ...e.account, platform: "instagram" } })).toBeNull();
    expect(parseInboxEvent({ ...e, id: "" })).toBeNull();
    expect(parseInboxEvent({ ...e, timestamp: "bad" })).toBeNull();
  });
});

describe("one-number plan guard", () => {
  it("does not create another connection when a number is linked", async () => {
    process.env["WHATSAPP_CONNECT_ENABLED"] = "true";
    try {
      expect((await bootstrap("venue-a", "Venue A")).ok).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      delete process.env["WHATSAPP_CONNECT_ENABLED"];
    }
  });
  it("does not silently replace an existing linked account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          accounts: [
            { _id: "account-other", profileId: "profile-a", platform: "whatsapp", isActive: true },
          ],
        }),
      ),
    );
    expect((await status("venue-a", "account-other")).ok).toBe(false);
    expect(state.db.rows("wa_channels")[0]?.["account_id"]).toBe("account-a");
  });
});

describe("missing production allowance setup", () => {
  it("blocks before the old reserve or provider when the read RPC is missing", async () => {
    const rpc = vi
      .spyOn(state.db, "rpc")
      .mockResolvedValue({ data: null, error: { message: "PGRST202" } });
    const result = await sendText("venue-a", "account-a", "27821234567", "hello");
    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledWith("wa_reply_usage", { p_tenant: "venue-a" });
    expect(rpc).not.toHaveBeenCalledWith("wa_reserve_budget", expect.anything());
    expect(fetch).not.toHaveBeenCalled();
  });
  it("blocks a denied allowance even when the old reservation would succeed", async () => {
    const rpc = vi
      .spyOn(state.db, "rpc")
      .mockResolvedValue({ data: { allowed: false }, error: null });
    expect((await sendText("venue-a", "account-a", "27821234567", "hello")).ok).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
