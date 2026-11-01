import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  member: true,
  confirmed: true,
  reserve: true,
  fetch: vi.fn(),
  auth: vi.fn(),
  patches: [] as string[],
}));
vi.mock("./db.server", () => ({
  db: async () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        update: (v: { status: string }) => {
          h.patches.push(v.status);
          return q;
        },
        maybeSingle: async () => ({ data: h.member ? { role: "owner" } : null, error: null }),
        then: (r: (x: unknown) => unknown) => Promise.resolve(r({ error: null })),
      };
      return q;
    },
    rpc: async () => ({ data: h.reserve, error: null }),
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { admin: { getUserById: h.auth } } },
}));
import { notifyMember, notificationCopy } from "./notification.server";
beforeEach(() => {
  vi.stubEnv("NOTIFICATION_EMAIL_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "fixture-key");
  vi.stubEnv("NOTIFICATION_EMAIL_FROM", "Flavourly <fixture@example.invalid>");
  h.member = true;
  h.confirmed = true;
  h.reserve = true;
  h.patches = [];
  h.auth.mockReset().mockImplementation(async () => ({
    data: {
      user: {
        email: "verified@example.invalid",
        email_confirmed_at: h.confirmed ? "today" : null,
      },
    },
    error: null,
  }));
  h.fetch.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("transactional member mail", () => {
  it("default OFF", async () => {
    vi.stubEnv("NOTIFICATION_EMAIL_ENABLED", "");
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "paused" });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("unconfigured does not send", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "unconfigured" });
  });
  it("requires membership", async () => {
    h.member = false;
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "forbidden" });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("requires confirmed auth email, never client recipient", async () => {
    h.confirmed = false;
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({
      status: "unverified_recipient",
    });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it("budget or duplicate fails closed", async () => {
    h.reserve = false;
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "held" });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it.each(["welcome", "paid_visit"] as const)(
    "sends only approved transactional kind %s",
    async (kind) => {
      expect(await notifyMember("a", "u", kind, "private-bill")).toEqual({ status: "accepted" });
      const init = h.fetch.mock.calls[0]![1];
      expect(JSON.parse(init.body).to).toEqual(["verified@example.invalid"]);
      expect(init.body).not.toContain("private-bill");
      expect(init.headers["Idempotency-Key"]).not.toContain("private-bill");
      expect(h.patches).toEqual(["accepted"]);
    },
  );
  it("provider failure is held without retry", async () => {
    h.fetch.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "held" });
    expect(h.fetch).toHaveBeenCalledOnce();
  });
  it("ambiguous network failure is held without retry", async () => {
    h.fetch.mockRejectedValue(Error("timeout"));
    expect(await notifyMember("a", "u", "welcome", "first")).toEqual({ status: "held" });
    expect(h.fetch).toHaveBeenCalledOnce();
  });
  it("plain email contains no vendor names or customer data", () => {
    for (const k of ["welcome", "paid_visit"] as const)
      expect(JSON.stringify(notificationCopy(k))).not.toMatch(
        /resend|lovable|supabase|customer phone/i,
      );
  });
});
