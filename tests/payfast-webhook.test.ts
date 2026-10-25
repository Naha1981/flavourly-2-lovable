import { beforeEach, describe, expect, it, vi } from "vitest";

import { md5, phpUrlEncode } from "@/lib/payfast.server";

/** Minimal in-memory stand-in for the two tables the webhook touches. */
const state = {
  tenant: { tenant_id: "the-table", plan_status: "trialing", payfast_subscription_token: null as string | null, plan_tier: "starter" },
  events: [] as Array<Record<string, unknown>>,
};

function chain(table: string) {
  const filters: Record<string, unknown> = {};
  const api = {
    select: () => api,
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      return api;
    },
    maybeSingle: async () => {
      if (table === "tenant_profiles") return { data: { ...state.tenant }, error: null };
      const found = state.events.find((e) => Object.entries(filters).every(([k, v]) => e[k] === v));
      return { data: found ? { id: "x" } : null, error: null };
    },
    update: (patch: Record<string, unknown>) => ({
      eq: async () => {
        Object.assign(state.tenant, patch);
        return { error: null };
      },
    }),
    upsert: async (row: Record<string, unknown>) => {
      if (!state.events.some((e) => e["pf_payment_id"] === row["pf_payment_id"] && e["payment_status"] === row["payment_status"])) {
        state.events.push(row);
      }
      return { error: null };
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => chain(t) } }));
vi.mock("@/lib/db.server", () => ({ db: async () => ({ from: (t: string) => chain(t) }) }));

const PASS = "a-test-passphrase";

function itn(overrides: Record<string, string> = {}, passphrase = PASS) {
  const fields: Array<[string, string]> = Object.entries({
    m_payment_id: "the-table:starter:abc",
    pf_payment_id: "1001",
    payment_status: "COMPLETE",
    amount_gross: "499.00",
    custom_str1: "the-table",
    merchant_id: "10000100",
    token: "tok-1",
    ...overrides,
  });
  const body = fields.map(([k, v]) => phpUrlEncode(k) + "=" + phpUrlEncode(v)).join("&");
  const signature = md5(body + "&passphrase=" + phpUrlEncode(passphrase));
  return new Request("https://app.example/api/public/billing/webhook", {
    method: "POST",
    body: body + "&signature=" + signature,
  });
}

const validPostback = (async () => new Response("VALID")) as unknown as typeof fetch;
const invalidPostback = (async () => new Response("INVALID")) as unknown as typeof fetch;

async function load() {
  return import("@/lib/billing.server");
}

beforeEach(() => {
  state.tenant = { tenant_id: "the-table", plan_status: "trialing", payfast_subscription_token: null, plan_tier: "starter" };
  state.events = [];
  process.env["PAYFAST_MERCHANT_ID"] = "10000100";
  process.env["PAYFAST_MERCHANT_KEY"] = "key";
  process.env["PAYFAST_PASSPHRASE"] = PASS;
  process.env["PAYFAST_SANDBOX"] = "true";
  process.env["PAYFAST_ALLOWED_IPS"] = "197.97.145.144/28";
});

describe("verifyPayFastWebhook", () => {
  it("activates a tenant on a valid COMPLETE notification", async () => {
    const { verifyPayFastWebhook } = await load();
    const result = await verifyPayFastWebhook(itn(), { fetchImpl: validPostback });
    expect(result.status).toBe("active");
    expect(state.tenant.plan_status).toBe("active");
    expect(state.tenant.payfast_subscription_token).toBe("tok-1");
  });

  it("treats a replayed notification as a no-op", async () => {
    const { verifyPayFastWebhook } = await load();
    await verifyPayFastWebhook(itn(), { fetchImpl: validPostback });
    state.tenant.plan_status = "past_due";
    const replay = await verifyPayFastWebhook(itn(), { fetchImpl: validPostback });
    expect(replay.status).toBe("duplicate");
    expect(state.tenant.plan_status).toBe("past_due");
  });

  it("does not revive a cancelled subscription from a late COMPLETE", async () => {
    const { verifyPayFastWebhook } = await load();
    state.tenant.plan_status = "canceled";
    state.tenant.payfast_subscription_token = "tok-1";
    const result = await verifyPayFastWebhook(itn({ pf_payment_id: "1002" }), { fetchImpl: validPostback });
    expect(result.status).toBe("stale");
    expect(state.tenant.plan_status).toBe("canceled");
  });

  it("lets a brand new subscription (new token) re-activate a cancelled tenant", async () => {
    const { verifyPayFastWebhook } = await load();
    state.tenant.plan_status = "canceled";
    state.tenant.payfast_subscription_token = "tok-old";
    const result = await verifyPayFastWebhook(itn({ pf_payment_id: "1003", token: "tok-new" }), { fetchImpl: validPostback });
    expect(result.status).toBe("active");
  });

  it("does not downgrade a cancelled tenant on a failed renewal", async () => {
    const { verifyPayFastWebhook } = await load();
    state.tenant.plan_status = "canceled";
    const result = await verifyPayFastWebhook(itn({ payment_status: "FAILED", pf_payment_id: "1004" }), { fetchImpl: validPostback });
    expect(result.status).toBe("stale");
    expect(state.tenant.plan_status).toBe("canceled");
  });

  it("marks an active tenant past_due on a failed payment", async () => {
    const { verifyPayFastWebhook } = await load();
    state.tenant.plan_status = "active";
    const result = await verifyPayFastWebhook(itn({ payment_status: "FAILED", pf_payment_id: "1005" }), { fetchImpl: validPostback });
    expect(result.status).toBe("past_due");
  });

  it("rejects when PayFast does not confirm the notification", async () => {
    const { verifyPayFastWebhook } = await load();
    await expect(verifyPayFastWebhook(itn(), { fetchImpl: invalidPostback })).rejects.toThrow(/postback/);
    expect(state.tenant.plan_status).toBe("trialing");
  });

  it("rejects a wrong amount for the tier", async () => {
    const { verifyPayFastWebhook } = await load();
    await expect(verifyPayFastWebhook(itn({ amount_gross: "1.00" }), { fetchImpl: validPostback })).rejects.toThrow(/amount/);
  });

  it("rejects a signature made with the wrong passphrase", async () => {
    const { verifyPayFastWebhook } = await load();
    await expect(verifyPayFastWebhook(itn({}, "not-the-passphrase"), { fetchImpl: validPostback })).rejects.toThrow(/signature/);
  });

  it("rejects a different merchant", async () => {
    const { verifyPayFastWebhook } = await load();
    await expect(verifyPayFastWebhook(itn({ merchant_id: "999" }), { fetchImpl: validPostback })).rejects.toThrow(/merchant/);
  });

  it("refuses to run live without a passphrase", async () => {
    const { verifyPayFastWebhook } = await load();
    process.env["PAYFAST_SANDBOX"] = "false";
    process.env["PAYFAST_PASSPHRASE"] = "";
    await expect(verifyPayFastWebhook(itn({}, ""), { fetchImpl: validPostback })).rejects.toThrow(/PASSPHRASE/);
  });
});

describe("assertPayFastSource", () => {
  it("is skipped in sandbox, enforced live, and ignores a forged first X-Forwarded-For", async () => {
    const { assertPayFastSource } = await load();
    const forged = new Request("https://x", { headers: { "x-forwarded-for": "197.97.145.150, 203.0.113.9" } });
    expect(() => assertPayFastSource(forged)).not.toThrow();
    process.env["PAYFAST_SANDBOX"] = "false";
    expect(() => assertPayFastSource(forged)).toThrow(/rejected/);
    const real = new Request("https://x", { headers: { "cf-connecting-ip": "197.97.145.150" } });
    expect(() => assertPayFastSource(real)).not.toThrow();
  });
});

describe("cancelSubscription", () => {
  it("cancels at PayFast with signed headers before marking the tenant cancelled", async () => {
    const { cancelSubscription } = await load();
    state.tenant.plan_status = "active";
    state.tenant.payfast_subscription_token = "tok-1";
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    });
    await cancelSubscription("the-table");
    vi.unstubAllGlobals();
    expect(calls[0]?.url).toBe("https://api.payfast.co.za/subscriptions/tok-1/cancel?testing=true");
    expect(calls[0]?.init.method).toBe("PUT");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["merchant-id"]).toBe("10000100");
    expect(headers["signature"]).toMatch(/^[0-9a-f]{32}$/);
    expect(headers["timestamp"]).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/);
    expect(state.tenant.plan_status).toBe("canceled");
  });

  it("does NOT mark the tenant cancelled when PayFast refuses", async () => {
    const { cancelSubscription } = await load();
    state.tenant.plan_status = "active";
    state.tenant.payfast_subscription_token = "tok-1";
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 401 }));
    await expect(cancelSubscription("the-table")).rejects.toThrow(/refused/);
    vi.unstubAllGlobals();
    expect(state.tenant.plan_status).toBe("active");
  });

  it("cancels locally when there is no PayFast subscription (trial)", async () => {
    const { cancelSubscription } = await load();
    await cancelSubscription("the-table");
    expect(state.tenant.plan_status).toBe("canceled");
  });
});
