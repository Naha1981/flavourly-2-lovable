import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

/**
 * STOP/START compliance: a guest who texts STOP must stop receiving automated
 * messages everywhere - auto-replies, campaign/lifecycle outbox jobs - while
 * START re-joins them. Also covers outbox attempt accounting: operator cold
 * starts ("waking") must not burn send attempts.
 */
const state: { db: FakeDb; send: ReturnType<typeof vi.fn> } = {
  db: createFakeDb(),
  send: vi.fn(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() { return state.db; },
}));
vi.mock("@/lib/wa-account.server", () => ({
  sendWhatsApp: (...a: unknown[]) => (state.send as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("../src/lib/wa-account.server", () => ({
  sendWhatsApp: (...a: unknown[]) => (state.send as (...x: unknown[]) => unknown)(...a),
}));

const SECRET = "test-webhook-secret";
const TENANT = "marble-jhb";
const PHONE = "27821234567";

function freshDb() {
  return createFakeDb({
    wa_messages: [["wa_message_id"]],
    wa_conversations: [["tenant_id", "chat_id"]],
    outbox_jobs: [["tenant_id", "dedupe_key"]],
    wa_opt_outs: [["tenant_id", "phone"]],
  });
}

async function postWebhook(body: unknown) {
  const { Route } = await import("@/routes/api/public/webhooks/whatsapp");
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
  const handlers = (Route.options as unknown as {
    server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } };
  }).server.handlers;
  return handlers.POST({
    request: new Request("http://x/api/public/webhooks/whatsapp", {
      method: "POST",
      body: raw,
      headers: { "x-webhook-signature": `sha256=${sig}` },
    }),
  });
}

const msg = (id: string, text: string) => ({
  tenantId: TENANT,
  waAccountId: "acc-1",
  data: { id, from: `${PHONE}@s.whatsapp.net`, pushName: "Lindiwe", text },
});

beforeEach(() => {
  process.env["WEBHOOK_SECRET"] = SECRET;
  state.db = freshDb();
  state.send.mockReset();
  state.send.mockResolvedValue({ ok: true, data: { messageId: "wamid-1" } });
  vi.useFakeTimers();
  // 10:00 in Johannesburg: inside the 07:00-20:00 send window.
  vi.setSystemTime(new Date("2026-10-14T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env["WEBHOOK_SECRET"];
});

describe("optOutKeyword", () => {
  it("detects stop and start keywords, ignores booking words", async () => {
    const { optOutKeyword } = await import("@/lib/opt-out.server");
    expect(optOutKeyword("STOP")).toBe("stop");
    expect(optOutKeyword("stop.")).toBe("stop");
    expect(optOutKeyword("Unsubscribe")).toBe("stop");
    expect(optOutKeyword("opt out")).toBe("stop");
    expect(optOutKeyword("START")).toBe("start");
    expect(optOutKeyword("cancel")).toBeNull(); // booking-cancel word, not an opt-out
    expect(optOutKeyword("please stop contacting me")).toBeNull(); // exact keyword only
  });
});

describe("inbound STOP handling", () => {
  it("records the opt-out, saves the message, resolves the conversation, sends no auto-reply", async () => {
    await state.db.from("tenant_profiles").insert({ tenant_id: TENANT, auto_replies_enabled: true });
    const res = await postWebhook(msg("m-stop-1", "STOP"));
    expect(res.status).toBe(200);

    const optOuts = state.db.rows("wa_opt_outs");
    expect(optOuts).toHaveLength(1);
    expect(optOuts[0]).toMatchObject({ tenant_id: TENANT, phone: PHONE });

    // Saved for the audit trail, conversation resolved, no outbound reply.
    expect(state.db.rows("wa_messages")).toHaveLength(1);
    expect(state.db.rows("wa_conversations")[0]).toMatchObject({ status: "resolved" });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.db.rows("outbox_jobs")).toHaveLength(0);
  });

  it("START removes the opt-out", async () => {
    await postWebhook(msg("m-stop-2", "STOP"));
    expect(state.db.rows("wa_opt_outs")).toHaveLength(1);
    await postWebhook(msg("m-start-1", "START"));
    expect(state.db.rows("wa_opt_outs")).toHaveLength(0);
  });
});

describe("outbox opt-out enforcement", () => {
  async function enqueue(automated: boolean) {
    const { enqueueOutbox } = await import("@/lib/outbox.server");
    return enqueueOutbox({ tenantId: TENANT, phone: PHONE, text: "Tuesday special!", automated });
  }

  it("blocks automated jobs to opted-out guests", async () => {
    await state.db.from("wa_opt_outs").insert({ tenant_id: TENANT, phone: PHONE });
    await enqueue(true);
    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox();
    expect(stats.skipped).toBe(1);
    expect(stats.sent).toBe(0);
    expect(state.send).not.toHaveBeenCalled();
    expect(state.db.rows("outbox_jobs")[0]).toMatchObject({ status: "opted_out" });
  });

  it("still sends non-automated (transactional) jobs", async () => {
    await state.db.from("wa_opt_outs").insert({ tenant_id: TENANT, phone: PHONE });
    await enqueue(false);
    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox();
    expect(stats.sent).toBe(1);
  });

  it("sends automated jobs to guests who are not opted out", async () => {
    await enqueue(true);
    const { processOutbox } = await import("@/lib/outbox.server");
    const stats = await processOutbox();
    expect(stats.sent).toBe(1);
  });
});

describe("outbox attempt accounting", () => {
  it("does not burn an attempt when the operator is waking", async () => {
    state.send.mockResolvedValue({ ok: false, error: "unreachable", waking: true });
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    await enqueueOutbox({ tenantId: TENANT, phone: PHONE, text: "hi", automated: true });
    await processOutbox();
    const job = state.db.rows("outbox_jobs")[0]!;
    expect(job["status"]).toBe("pending");
    expect(job["attempts"]).toBe(0);
  });

  it("burns attempts only on real failures and fails after the cap", async () => {
    state.send.mockResolvedValue({ ok: false, error: "permanent reject" });
    const { enqueueOutbox, processOutbox } = await import("@/lib/outbox.server");
    await enqueueOutbox({ tenantId: TENANT, phone: PHONE, text: "hi", automated: true });
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(11 * 60 * 1000);
      await processOutbox();
    }
    const job = state.db.rows("outbox_jobs")[0]!;
    expect(job["status"]).toBe("failed");
    expect(job["attempts"]).toBe(3);
  });
});
