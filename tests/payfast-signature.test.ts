import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPayFastSignature, createCheckout, verifyPayFastWebhook } from "@/lib/billing.server";

const managedEnv = [
  "PAYFAST_MERCHANT_ID",
  "PAYFAST_MERCHANT_KEY",
  "PAYFAST_PASSPHRASE",
  "PAYFAST_SANDBOX",
  "PUBLIC_APP_URL",
] as const;
const previousEnv = new Map<string, string | undefined>();

function phpEncode(value: string) {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E");
}
function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

beforeEach(() => {
  for (const key of managedEnv) previousEnv.set(key, process.env[key]);
  process.env["PAYFAST_MERCHANT_ID"] = "10000100";
  process.env["PAYFAST_MERCHANT_KEY"] = "test-merchant-key";
  process.env["PAYFAST_PASSPHRASE"] = "test phrase";
  process.env["PAYFAST_SANDBOX"] = "true";
  process.env["PUBLIC_APP_URL"] = "https://app.example";
});

afterEach(() => {
  for (const key of managedEnv) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnv.clear();
});

describe("PayFast custom form signatures", () => {
  it("preserves insertion order and excludes blank values instead of sorting", () => {
    const data = { z_field: "last", a_field: "first", blank: "" };
    const actual = buildPayFastSignature(data, "salt");
    expect(actual).toBe(md5("z_field=last&a_field=first&passphrase=salt"));
  });

  it("uses PayFast's documented checkout attribute order and URL encoding", async () => {
    const checkout = await createCheckout("marble-jhb", "starter");
    const url = new URL(checkout.redirectUrl);
    const data = Object.fromEntries([...url.searchParams.entries()].filter(([key]) => key !== "signature"));
    const documentedOrder = [
      "merchant_id",
      "merchant_key",
      "return_url",
      "cancel_url",
      "notify_url",
      "m_payment_id",
      "amount",
      "item_name",
      "custom_str1",
      "custom_str2",
      "subscription_type",
      "recurring_amount",
      "frequency",
      "cycles",
    ];
    expect([...url.searchParams.keys()].filter((key) => key !== "signature")).toEqual(documentedOrder);
    const parameterString = documentedOrder
      .filter((key) => (data[key] ?? "").trim() !== "")
      .map((key) => key + "=" + phpEncode(data[key] ?? ""))
      .join("&") + "&passphrase=" + phpEncode("test phrase");
    expect(url.searchParams.get("signature")).toBe(md5(parameterString));
  });

  it("refuses subscription checkout when no passphrase is configured", async () => {
    delete process.env["PAYFAST_PASSPHRASE"];
    await expect(createCheckout("marble-jhb", "starter")).rejects.toThrow(/PAYFAST_PASSPHRASE/);
  });

  it("rejects an ITN whose amount was changed after signing", async () => {
    const data: Record<string, string> = {
      m_payment_id: "marble-jhb:starter:checkout-uuid",
      pf_payment_id: "123456",
      payment_status: "COMPLETE",
      item_name: "Flavourly starter monthly subscription",
      amount_gross: "4.99",
      custom_str1: "marble-jhb",
      custom_str2: "starter",
      merchant_id: "10000100",
      token: "subscription-token",
    };
    const signature = buildPayFastSignature(data, process.env["PAYFAST_PASSPHRASE"] ?? "");
    const form = new URLSearchParams({ ...data, signature });
    form.set("amount_gross", "999.99");
    await expect(verifyPayFastWebhook(new Request("https://app.example/api/public/billing/webhook", {
      method: "POST",
      body: form.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }))).rejects.toThrow(/signature mismatch/);
  });

  it("rejects an ITN whose tenant was changed after signing", async () => {
    const data: Record<string, string> = {
      m_payment_id: "marble-jhb:starter:checkout-uuid",
      pf_payment_id: "123457",
      payment_status: "COMPLETE",
      item_name: "Flavourly starter monthly subscription",
      amount_gross: "4.99",
      custom_str1: "marble-jhb",
      custom_str2: "starter",
      merchant_id: "10000100",
      token: "subscription-token",
    };
    const signature = buildPayFastSignature(data, process.env["PAYFAST_PASSPHRASE"] ?? "");
    const form = new URLSearchParams({ ...data, signature });
    form.set("custom_str1", "other-tenant");
    await expect(verifyPayFastWebhook(new Request("https://app.example/api/public/billing/webhook", {
      method: "POST",
      body: form.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }))).rejects.toThrow(/signature mismatch/);
  });
});
