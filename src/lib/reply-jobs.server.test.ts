/* eslint-disable @typescript-eslint/no-explicit-any -- Disposable database and fluent client fixtures. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  auto: vi.fn(),
  patches: [] as any[],
  jobs: [] as any[],
  review: vi.fn(),
}));
vi.mock("./db.server", () => ({
  db: async () => ({
    rpc: h.rpc,
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        limit: () => q,
        in: () => q,
        update: (v: any) => {
          h.patches.push({ table, ...v });
          return q;
        },
        then: (r: any) =>
          Promise.resolve(r({ data: table === "wa_reply_jobs" ? h.jobs : [], error: null })),
      };
      return q;
    },
  }),
}));
vi.mock("./auto-reply.server", () => ({ autoReply: h.auto }));
vi.mock("./review-requests.server", () => ({ flagReviewFeedback: h.review }));
import { processReplyJobs } from "./reply-jobs.server";
const job = {
  id: "job",
  tenant_id: "synthetic",
  conversation_id: "c",
  message_id: "m",
  account_id: "a",
  phone: "27610000000",
  guest_name: null,
  body: "SYNTHETIC tea price?",
  inbound_at: new Date().toISOString(),
  claim_token: "claim",
};
beforeEach(() => {
  vi.stubEnv("WHATSAPP_SEND_ENABLED", "true");
  h.patches = [];
  h.jobs = [];
  h.review.mockReset().mockResolvedValue(false);
  h.auto.mockReset();
  let claimed = false;
  h.rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === "wa_claim_reply") {
      if (claimed) return { data: [], error: null };
      claimed = true;
      return { data: [job], error: null };
    }
    return { data: true, error: null };
  });
});
describe("durable reply worker", () => {
  it("global OFF neither claims nor sends", async () => {
    vi.stubEnv("WHATSAPP_SEND_ENABLED", "");
    await processReplyJobs();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.auto).not.toHaveBeenCalled();
  });
  it("records send intent before normal auto-reply sends and persists accepted ID", async () => {
    h.auto.mockImplementation(async (i: any) => {
      expect(await i.durable.beforeSend("R20")).toBe(true);
      await i.durable.accepted("provider-id");
      return { replied: true };
    });
    await processReplyJobs();
    expect(h.rpc).toHaveBeenCalledWith("wa_begin_reply_send", {
      p_job: "job",
      p_claim: "claim",
      p_text: "R20",
    });
    expect(h.rpc).toHaveBeenCalledWith("wa_accept_reply", {
      p_job: "job",
      p_claim: "claim",
      p_provider: "provider-id",
    });
  });
  it("timeout holds and never invokes a second send in the same run", async () => {
    h.auto.mockImplementation(async (i: any) => {
      await i.durable.beforeSend("R20");
      throw new Error("provider result uncertain");
    });
    await processReplyJobs();
    expect(h.auto).toHaveBeenCalledTimes(1);
    expect(h.patches.some((p) => p.state === "held")).toBe(true);
    expect(h.patches.some((p) => p.status === "needs_approval")).toBe(true);
  });
  it("failed send-intent write aborts before provider continuation", async () => {
    h.rpc.mockImplementation(async (name: string) =>
      name === "wa_claim_reply"
        ? { data: [job], error: null }
        : { data: null, error: { message: "fixture" } },
    );
    const send = vi.fn();
    h.auto.mockImplementation(async (i: any) => {
      await i.durable.beforeSend("R20");
      send();
      return { replied: true };
    });
    await processReplyJobs(1);
    expect(send).not.toHaveBeenCalled();
    expect(h.patches.some((p) => p.state === "held")).toBe(true);
  });
  it("consent/handoff/activation decline is visible, not silently open", async () => {
    h.auto.mockResolvedValue({ replied: false });
    await processReplyJobs();
    expect(h.patches.some((p) => p.status === "needs_approval")).toBe(true);
    expect(h.rpc.mock.calls.some((c) => c[0] === "wa_begin_reply_send")).toBe(false);
  });
  it("accepted audit work only reconciles, never calls autoReply when no queued job", async () => {
    h.jobs = [{ id: "accepted" }];
    h.rpc.mockImplementation(async (name: string) => ({
      data: name === "wa_claim_reply" ? [] : true,
      error: null,
    }));
    await processReplyJobs();
    expect(h.auto).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledWith("wa_reconcile_reply", { p_job: "accepted" });
  });
});
