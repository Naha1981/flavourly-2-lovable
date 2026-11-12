import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  patches: [] as Array<Record<string, unknown>>,
  venue: {
    name: "Test",
    google_review_url: "https://g.page/r/test/review",
    review_requests_enabled: true,
  },
  clicked: false,
  consent: true,
  opted: false,
  claimed: true,
  send: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
}));
vi.mock("./db.server", () => ({
  APP_URL: () => "https://flavourly.example",
  db: async () => ({
    from: (table: string) => {
      let patch: Record<string, unknown> | null = null;
      const q = {
        select: () => q,
        update: (p: Record<string, unknown>) => {
          patch = p;
          h.patches.push(p);
          return q;
        },
        eq: () => q,
        gte: () => q,
        lte: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({
          data:
            table === "tenant_profiles"
              ? h.venue
              : table === "customers"
                ? { review_consent_at: h.consent ? "today" : null }
                : { clicked_at: h.clicked ? "today" : null },
          error: null,
        }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: patch ? null : h.rows, error: null })),
      };
      return q;
    },
    rpc: h.rpc,
  }),
}));
vi.mock("./whatsapp.server", () => ({ channel: h.channel, sendText: h.send }));
vi.mock("./opt-out.server", () => ({ isOptedOut: async () => h.opted }));
import { runReviewRequests, followReviewLink } from "./review-requests.server";
const now = new Date("2026-11-01T12:00:00Z");
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("REVIEW_AUTOMATION_ENABLED", "true");
  vi.stubEnv("WHATSAPP_SEND_ENABLED", "true");
  h.patches = [];
  h.venue.review_requests_enabled = true;
  h.clicked = false;
  h.opted = false;
  h.consent = true;
  h.rows = [
    {
      id: "one",
      tenant_id: "a",
      customer_id: "c",
      phone: "27820000000",
      step: "check_in",
      token: "a".repeat(64),
      due_at: now.toISOString(),
    },
  ];
  h.send.mockReset().mockResolvedValue({ ok: true, data: { status: "accepted" } });
  h.channel.mockReset().mockResolvedValue({ account_id: "number" });
  h.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});
describe("guarded review worker", () => {
  it("defaults OFF", async () => {
    vi.stubEnv("REVIEW_AUTOMATION_ENABLED", "");
    expect(await runReviewRequests(now)).toMatchObject({ paused: true });
    expect(h.send).not.toHaveBeenCalled();
  });
  it("venue OFF prevents claim/send", async () => {
    h.venue.review_requests_enabled = false;
    await runReviewRequests(now);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });
  it("transport OFF prevents send", async () => {
    vi.stubEnv("WHATSAPP_SEND_ENABLED", "");
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("claims once then schedules review two hours after check-in acceptance", async () => {
    await runReviewRequests(now);
    expect(h.send).toHaveBeenCalledOnce();
    expect(h.patches.at(-1)).toMatchObject({
      step: "review",
      state: "scheduled",
      due_at: "2026-11-01T14:00:00.000Z",
    });
  });
  it("review schedules reminder after48h with tracked neutral link", async () => {
    h.rows[0]!["step"] = "review";
    await runReviewRequests(now);
    expect(h.send.mock.calls[0]![3]).toContain("https://flavourly.example/review/");
    expect(h.patches.at(-1)).toMatchObject({
      step: "reminder",
      due_at: "2026-11-03T12:00:00.000Z",
    });
  });
  it("reminder finishes without another message", async () => {
    h.rows[0]!["step"] = "reminder";
    await runReviewRequests(now);
    expect(h.patches.at(-1)).toMatchObject({ state: "done" });
  });
  it("lost claim does not send", async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("STOP cancels", async () => {
    h.opted = true;
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.patches.at(-1)).toMatchObject({ state: "cancelled" });
  });
  it("withdrawn consent cancels", async () => {
    h.consent = false;
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("opened link cancels reminder", async () => {
    h.rows[0]!["step"] = "reminder";
    h.clicked = true;
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.patches.at(-1)).toMatchObject({ state: "cancelled" });
  });
  it.each(["Allowance reached", "Recent inbound needed", "Provider failure"])(
    "holds failed/ambiguous sends without retry: %s",
    async (error) => {
      h.send.mockResolvedValue({ ok: false, error });
      await runReviewRequests(now);
      expect(h.send).toHaveBeenCalledOnce();
      expect(h.patches.at(-1)).toMatchObject({ state: "held", error });
    },
  );
  it("invalid destination holds", async () => {
    h.rows[0]!["review_url"] = "https://evil.invalid";
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("expired backlog holds", async () => {
    h.rows[0]!["due_at"] = "2026-10-29T12:00:00Z";
    await runReviewRequests(now);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("invalid tokens never reach database", async () => {
    expect(await followReviewLink("no")).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
