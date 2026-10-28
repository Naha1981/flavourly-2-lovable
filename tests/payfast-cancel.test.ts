/**
 * Cancelling a subscription must be done at PayFast (signed REST call) BEFORE the
 * restaurant is shown as cancelled; otherwise PayFast keeps debiting the card.
 * Also pins CIDR support for the PayFast source-IP allow-list.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertPayFastSource, cancelSubscription, ipAllowed, payFastApiSignature, payFastApiTimestamp } from "@/lib/billing.server";
import { PF_SANDBOX_ENV } from "./helpers/fake-payfast";

const state = vi.hoisted(() => ({
  token: "tok-123" as string | null,
  status: "active",
  updateError: null as { message: string } | null,
}));

vi.mock("@/lib/db.server", () => ({ db: async () => ({}) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { payfast_subscription_token: state.token }, error: null }) }) }),
      update: (patch: { plan_status: string }) => ({
        eq: async () => {
          if (!state.updateError) state.status = patch.plan_status;
          return { error: state.updateError };
        },
      }),
    }),
  },
}));

const md5 = (value: string) => createHash("md5").update(value).digest("hex");
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn<typeof fetch>();
const managedEnv = ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE", "PAYFAST_SANDBOX", "PUBLIC_APP_URL", "PAYFAST_ALLOWED_IPS"] as const;
const previousEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of managedEnv) previousEnv.set(key, process.env[key]);
  Object.assign(process.env, PF_SANDBOX_ENV);
  state.token = "tok-123";
  state.status = "active";
  state.updateError = null;
  mockFetch.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  for (const key of managedEnv) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnv.clear();
  globalThis.fetch = originalFetch;
});

describe("cancelSubscription", () => {
  it("calls PUT /subscriptions/{token}/cancel with signed headers, then marks the tenant cancelled", async () => {
    await cancelSubscription("marble-jhb");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.payfast.co.za/subscriptions/tok-123/cancel?testing=true");
    expect(init.method).toBe("PUT");
    const headers = init.headers as Record<string, string>;
    expect(headers["merchant-id"]).toBe("10000100");
    expect(headers["version"]).toBe("v1");
    expect(headers["timestamp"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/);
    expect(headers["signature"]).toBe(
      payFastApiSignature({ "merchant-id": "10000100", version: "v1", timestamp: headers["timestamp"] as string }, "test phrase"),
    );
    expect(state.status).toBe("canceled");
  });

  it("uses the live host without the testing flag when not in sandbox", async () => {
    process.env["PAYFAST_SANDBOX"] = "false";
    await cancelSubscription("marble-jhb");
    expect((mockFetch.mock.calls[0] as [string])[0]).toBe("https://api.payfast.co.za/subscriptions/tok-123/cancel");
  });

  it("does NOT mark the tenant cancelled when PayFast refuses, and tells the caller", async () => {
    mockFetch.mockResolvedValue(new Response("unauthorised", { status: 401 }));
    await expect(cancelSubscription("marble-jhb")).rejects.toThrow(/refused to cancel/);
    expect(state.status).toBe("active");
  });

  it("does NOT mark the tenant cancelled when PayFast is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    await expect(cancelSubscription("marble-jhb")).rejects.toThrow();
    expect(state.status).toBe("active");
  });

  it("cancels locally, without calling PayFast, when there is no subscription (trial)", async () => {
    state.token = null;
    await cancelSubscription("marble-jhb");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(state.status).toBe("canceled");
  });

  it("reports a failure to save the cancellation", async () => {
    state.updateError = { message: "db down" };
    await expect(cancelSubscription("marble-jhb")).rejects.toThrow("db down");
  });
});

describe("PayFast API signature", () => {
  it("sorts headers and passphrase alphabetically, url-encoded", () => {
    const expected = md5("merchant-id=10000100&passphrase=a+b&timestamp=2026-10-27T10%3A00%3A00&version=v1");
    expect(payFastApiSignature({ version: "v1", "merchant-id": "10000100", timestamp: "2026-10-27T10:00:00" }, "a b")).toBe(expected);
  });

  it("formats timestamps without milliseconds", () => {
    expect(payFastApiTimestamp(new Date("2026-10-27T10:00:00.789Z"))).toBe("2026-10-27T10:00:00");
  });
});

describe("PayFast source-IP allow-list", () => {
  const allow = ["197.97.145.144/28", "144.126.193.139"];

  it("matches exact IPs and CIDR ranges", () => {
    expect(ipAllowed("197.97.145.150", allow)).toBe(true);
    expect(ipAllowed("144.126.193.139", allow)).toBe(true);
    expect(ipAllowed("197.97.145.200", allow)).toBe(false);
    expect(ipAllowed("10.0.0.1", allow)).toBe(false);
  });

  it("ignores malformed entries instead of matching everything", () => {
    expect(ipAllowed("1.2.3.4", ["", "garbage", "1.2.3.4/99", "1.2.3/24"])).toBe(false);
  });

  it("assertPayFastSource accepts an address inside a configured CIDR range and rejects others", () => {
    process.env["PAYFAST_SANDBOX"] = "false";
    process.env["PAYFAST_ALLOWED_IPS"] = "197.97.145.144/28";
    const request = (ip: string) => new Request("https://app.example", { headers: { "cf-connecting-ip": ip } });
    expect(() => assertPayFastSource(request("197.97.145.151"))).not.toThrow();
    expect(() => assertPayFastSource(request("203.0.113.9"))).toThrow(/rejected/);
  });
});
