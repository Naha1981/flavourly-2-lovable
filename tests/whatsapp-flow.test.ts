import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

/**
 * End-to-end flow for WhatsApp, with the database and the WhatsApp service faked:
 * incoming message -> saved -> auto-reply (or held for approval) -> outbox -> retries.
 */
type SendMock = Mock<(...args: unknown[]) => Promise<unknown>>;
const state: { db: FakeDb; send: SendMock } = {
  db: createFakeDb(),
  send: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.db;
  },
}));
vi.mock("@/lib/wa-account.server", () => ({
  sendWhatsApp: (...a: unknown[]) => state.send(...a),
}));
vi.mock("../src/lib/wa-account.server", () => ({
  sendWhatsApp: (...a: unknown[]) => state.send(...a),
}));

const SECRET = "test-webhook-secret";
const TENANT = "marble-jhb";

function freshDb() {
  return createFakeDb({
    wa_messages: [["wa_message_id"]],
    wa_conversations: [["tenant_id", "chat_id"]],
    outbox_jobs: [["tenant_id", "dedupe_key"]],
    customers: [["tenant_id", "phone"]],
  });
}

async function postWebhook(body: unknown, secret = SECRET) {
  const { Route } = await import("@/routes/api/public/webhooks/whatsapp");
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  const handlers = (
    Route.options as unknown as {
      server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } };
    }
  ).server.handlers;
  return handlers.POST({
    request: new Request("http://x/api/public/webhooks/whatsapp", {
      method: "POST",
      body: raw,
      headers: { "x-zernio-signature": `sha256=${sig}` },
    }),
  });
}

const msg = (id: string, text: string) => ({
  id: `evt-${id}`,
  event: "message.received",
  timestamp: new Date().toISOString(),
  account: { accountId: "acc-1", profileId: "profile-1", platform: "whatsapp" },
  conversation: { id: "conversation-1" },
  message: { id, sender: { phoneNumber: "27821234567", name: "Lindiwe" }, text },
});

beforeEach(() => {
  // 10:00 in Johannesburg: inside the 07:00–20:00 send window.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T08:00:00Z"));
  process.env["ZERNIO_WEBHOOK_SECRET"] = SECRET;
  state.db = freshDb();
  state.db
    .rows("wa_channels")
    .push({ tenant_id: TENANT, account_id: "acc-1", profile_id: "profile-1" });
  state.send = vi.fn().mockResolvedValue({ ok: true, data: { messageId: "out-1" } });
});
afterEach(() => vi.useRealTimers());

describe("incoming WhatsApp webhook", () => {
  it("rejects a request with the wrong signature and saves nothing", async () => {
    const res = await postWebhook(msg("m1", "Hi"), "wrong-secret");
    expect(res.status).toBe(401);
    expect(state.db.rows("wa_messages")).toHaveLength(0);
  });

  it("saves a guest message into a new open conversation", async () => {
    const res = await postWebhook(msg("m1", "Can I book a table for 4 tonight?"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, saved: 1 });
    const [conv] = state.db.rows("wa_conversations");
    expect(conv).toMatchObject({ tenant_id: TENANT, intent: "booking", status: "open", unread: 1 });
    expect(state.db.rows("wa_messages")[0]).toMatchObject({ direction: "in", wa_message_id: "m1" });
    expect(state.db.rows("wa_webhook_events")[0]).toMatchObject({ status: "processed", saved: 1 });
  });

  it("ignores a duplicate delivery of the same message", async () => {
    await postWebhook(msg("m1", "Hello"));
    const res = await postWebhook(msg("m1", "Hello"));
    expect(await res.json()).toEqual({ ok: true, saved: 0 });
    expect(state.db.rows("wa_messages")).toHaveLength(1);
    expect(state.db.rows("wa_conversations")[0]?.["unread"]).toBe(1);
  });
});

describe("approval-required replies", () => {
  it("holds a refund reply as red and does not send it", async () => {
    const { enqueueOutbox } = await import("@/lib/outbox.server");
    const r = await enqueueOutbox({
      tenantId: TENANT,
      phone: "+27 82 123 4567",
      automated: true,
      text: "We will issue a full refund for your meal.",
    });
    expect(r.approvalRequired).toBe(true);
    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("approval_required");
    expect(state.db.rows("approval_requests")[0]).toMatchObject({
      risk_level: "red",
      recipient_phone: "27821234567",
    });

    const { processOutbox } = await import("@/lib/outbox.server");
    await processOutbox();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("sends the edited text once a manager approves", async () => {
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    const { resolveApproval } = await import("@/lib/approval.server");
    await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "Here is a discount voucher.",
    });
    const approval = state.db.rows("approval_requests")[0]!;
    expect(approval["risk_level"]).toBe("yellow");

    const ok = await resolveApproval({
      tenantId: TENANT,
      approvalId: String(approval["id"]),
      approved: true,
      resolvedBy: "Thabo",
      editedMessage: "Enjoy 10% off your next visit.",
    });
    expect(ok.ok).toBe(true);
    const again = await resolveApproval({
      tenantId: TENANT,
      approvalId: String(approval["id"]),
      approved: true,
      resolvedBy: "Lerato",
    });
    expect(again.ok).toBe(false);

    await processOutbox();
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.send.mock.calls[0]?.[2]).toBe("Enjoy 10% off your next visit.");
    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("sent");
  });

  it("never sends a rejected reply", async () => {
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    const { resolveApproval } = await import("@/lib/approval.server");
    await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "Sorry, talk to our lawyer.",
    });
    const approval = state.db.rows("approval_requests")[0]!;
    await resolveApproval({
      tenantId: TENANT,
      approvalId: String(approval["id"]),
      approved: false,
      resolvedBy: "Thabo",
    });
    await processOutbox();
    expect(state.send).not.toHaveBeenCalled();
    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("rejected");
  });

  it("sends routine replies straight away", async () => {
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    const r = await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "Your table is ready at 19:00.",
    });
    expect(r.queued).toBe(true);
    await processOutbox();
    expect(state.send).toHaveBeenCalledTimes(1);
  });
});

describe("outbound delivery safety", () => {
  it("holds a failed send after one attempt across later cron runs", async () => {
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    state.send = vi.fn().mockResolvedValue({ ok: false, error: "operator offline" });
    await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "See you at 19:00.",
    });
    expect(await processOutbox()).toMatchObject({ failed: 1, retried: 0 });
    expect(state.db.rows("outbox_jobs")[0]).toMatchObject({ status: "failed", attempts: 1 });
    vi.setSystemTime(new Date("2026-10-05T09:00:00Z"));
    await processOutbox();
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("never turns an ambiguous timeout into an automatic second send or audit claim", async () => {
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    state.send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "timeout" })
      .mockResolvedValueOnce({ ok: true, data: { messageId: "would-duplicate" } });
    state.db.rows("wa_conversations").push({ id: "conv-1", tenant_id: TENANT });
    await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "Confirmed!",
      conversationId: "conv-1",
    });
    await processOutbox();
    vi.setSystemTime(new Date("2026-10-05T08:15:00Z"));
    expect(await processOutbox()).toMatchObject({ sent: 0, retried: 0 });
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(state.db.rows("wa_messages")).toHaveLength(0);
  });

  it("holds automated sends outside 07:00–20:00 Johannesburg time", async () => {
    vi.setSystemTime(new Date("2026-10-05T19:30:00Z")); // 21:30 SAST
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    await enqueueOutbox({
      tenantId: TENANT,
      phone: "27821234567",
      automated: true,
      text: "Thanks for visiting!",
    });
    expect(state.db.rows("outbox_jobs")[0]?.["status"]).toBe("quiet_hours_delayed");
    await processOutbox();
    expect(state.send).not.toHaveBeenCalled();
  });
});
