/**
 * Simulated PayFast sandbox ITN lifecycle: subscription start, duplicate
 * delivery, out-of-order arrival, cancellation, unknown statuses and
 * postback failures - all without a real PayFast account or network.
 * Ordering of out-of-sequence events is decided by the apply_payfast_itn
 * database function; these tests pin the contract Flavourly sends to it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertPayFastSource, verifyPayFastWebhook } from "@/lib/billing.server";
import { buildSignedItn, itnRequest, PF_SANDBOX_ENV } from "./helpers/fake-payfast";

const mockState = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/db.server", () => ({
  db: async () => ({ rpc: mockState.rpc }),
}));

const managedEnv = [
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
  "PAYFAST_SANDBOX",
  "PUBLIC_APP_URL",
  "PAYFAST_ALLOWED_IPS",
] as const;
const previousEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  for (const key of managedEnv) previousEnv.set(key, process.env[key]);
  Object.assign(process.env, PF_SANDBOX_ENV);
  mockState.rpc.mockReset().mockResolvedValue({ data: [{ accepted: true, outcome: "complete" }], error: null });
  mockFetch.mockReset().mockImplementation(async () => new Response("VALID", { status: 200 }));
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

describe("simulated sandbox ITN lifecycle", () => {
  it("runs start -> duplicate -> cancel with the right contract to the DB", async () => {
    // 1. First successful debit starts the subscription.
    const first = await verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      pfPaymentId: "2001",
      paymentDate: "2026-10-01T08:00:00Z",
    })));
    expect(first).toMatchObject({ ok: true, tenantId: "marble-jhb", replay: false });
    expect(mockState.rpc).toHaveBeenLastCalledWith("apply_payfast_itn", expect.objectContaining({
      p_pf_payment_id: "2001",
      p_tenant_id: "marble-jhb",
      p_payment_status: "COMPLETE",
      p_tier: "premium",
      p_event_at: "2026-10-01T08:00:00.000Z",
    }));

    // 2. PayFast retries the same ITN: the DB reports a duplicate, we no-op.
    mockState.rpc.mockResolvedValueOnce({ data: [{ accepted: false, outcome: "duplicate" }], error: null });
    const replay = await verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      pfPaymentId: "2001",
      paymentDate: "2026-10-01T08:00:00Z",
    })));
    expect(replay).toMatchObject({ status: "duplicate", replay: true });

    // 3. Cancellation ITN carries no gross amount and must still verify.
    const cancel = await verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      pfPaymentId: "2002",
      status: "CANCELLED",
      amountGross: null,
      paymentDate: "2026-10-20T09:30:00Z",
    })));
    expect(cancel).toMatchObject({ ok: true });
    expect(mockState.rpc).toHaveBeenLastCalledWith("apply_payfast_itn", expect.objectContaining({
      p_payment_status: "CANCELLED",
      p_event_at: "2026-10-20T09:30:00.000Z",
    }));
  });

  it("forwards the payment_date of an out-of-order FAILED ITN for the DB to arbitrate", async () => {
    // A late-arriving FAILED dated before the subscription started must reach
    // the DB with its own timestamp so apply_payfast_itn can discard it.
    const stale = await verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      pfPaymentId: "1999",
      status: "FAILED",
      paymentDate: "2026-09-28T07:00:00Z",
    })));
    expect(stale).toMatchObject({ ok: true });
    expect(mockState.rpc).toHaveBeenLastCalledWith("apply_payfast_itn", expect.objectContaining({
      p_payment_status: "FAILED",
      p_event_at: "2026-09-28T07:00:00.000Z",
    }));
  });

  it("still postback-verifies an unrecognised status, then ignores it without touching the DB", async () => {
    const result = await verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      status: "PENDING",
    })));
    expect(result).toMatchObject({ ok: true, status: "ignored" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://sandbox.payfast.co.za/eng/query/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockState.rpc).not.toHaveBeenCalled();
  });

  it("rejects when PayFast postback says INVALID and never touches the DB", async () => {
    mockFetch.mockResolvedValueOnce(new Response("INVALID", { status: 200 }));
    await expect(verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
    })))).rejects.toThrow(/postback validation failed/);
    expect(mockState.rpc).not.toHaveBeenCalled();
  });

  it("rejects when the postback endpoint errors", async () => {
    mockFetch.mockResolvedValueOnce(new Response("upstream error", { status: 502 }));
    await expect(verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
    })))).rejects.toThrow(/postback validation failed/);
  });

  it("rejects a COMPLETE ITN with no gross amount", async () => {
    await expect(verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      amountGross: null,
    })))).rejects.toThrow(/missing gross amount/);
  });

  it("rejects a signed ITN from a different merchant", async () => {
    await expect(verifyPayFastWebhook(itnRequest(buildSignedItn({
      tenantId: "marble-jhb",
      tier: "premium",
      merchantId: "99999999",
    })))).rejects.toThrow(/merchant mismatch/);
  });

  it("rejects a body with a duplicated field", async () => {
    const body = buildSignedItn({ tenantId: "marble-jhb", tier: "premium" }) + "&token=second";
    await expect(verifyPayFastWebhook(itnRequest(body))).rejects.toThrow(/Duplicate PayFast field/);
  });
});

describe("PayFast source allowlist", () => {
  it("requires the allowlist and the platform source header", () => {
    delete process.env["PAYFAST_ALLOWED_IPS"];
    expect(() => assertPayFastSource(itnRequest("x"))).toThrow(/PAYFAST_ALLOWED_IPS/);

    process.env["PAYFAST_ALLOWED_IPS"] = "197.242.144.10, 41.74.176.20";
    expect(() => assertPayFastSource(itnRequest("x"))).toThrow(/source IP rejected/);
    expect(() =>
      assertPayFastSource(itnRequest("x", { "cf-connecting-ip": "197.242.144.10" })),
    ).not.toThrow();
    expect(() =>
      assertPayFastSource(itnRequest("x", { "x-forwarded-for": "197.242.144.10" })),
    ).toThrow(/source IP rejected/);
  });
});
