import { describe, expect, it } from "vitest";

import {
  apiSignature,
  apiTimestamp,
  checkoutQuery,
  checkoutSignature,
  ipAllowed,
  itnPostbackBody,
  md5,
  orderCheckoutFields,
  parseItnBody,
  phpUrlEncode,
  trustedClientIp,
  verifyItnSignature,
} from "@/lib/payfast.server";

const PASS = "a-test-passphrase";

/** Builds an ITN body the way PayFast does: fields in their own order, signature last. */
function signedItn(fields: Array<[string, string]>, passphrase = PASS, opts: { includeBlanks?: boolean } = {}) {
  const includeBlanks = opts.includeBlanks ?? true;
  const body = fields
    .filter(([, v]) => includeBlanks || v !== "")
    .map(([k, v]) => phpUrlEncode(k) + "=" + phpUrlEncode(v))
    .join("&");
  const signature = md5(body + (passphrase ? "&passphrase=" + phpUrlEncode(passphrase) : ""));
  return new URLSearchParams([...fields, ["signature", signature]]).toString();
}

const ITN: Array<[string, string]> = [
  ["m_payment_id", "the-table:premium:11111111-2222-3333-4444-555555555555"],
  ["pf_payment_id", "1089250"],
  ["payment_status", "COMPLETE"],
  ["item_name", "Flavourly premium monthly subscription"],
  ["amount_gross", "1499.00"],
  ["custom_str1", "the-table"],
  ["custom_str2", ""],
  ["name_first", "Test User"],
  ["email_address", "owner@example.co.za"],
  ["merchant_id", "10000100"],
  ["token", "dc0521d3-55fe-269b-fa00-b647310d760f"],
];

describe("PayFast ITN signature", () => {
  it("accepts a correctly signed notification in the order received", () => {
    expect(verifyItnSignature(parseItnBody(signedItn(ITN)), PASS)).toBe(true);
  });

  it("accepts a notification signed without blank values", () => {
    expect(verifyItnSignature(parseItnBody(signedItn(ITN, PASS, { includeBlanks: false })), PASS)).toBe(true);
  });

  it("rejects a tampered amount", () => {
    const tampered = signedItn(ITN).replace("amount_gross=1499.00", "amount_gross=1.00");
    expect(verifyItnSignature(parseItnBody(tampered), PASS)).toBe(false);
  });

  it("rejects a signature made with the wrong passphrase", () => {
    expect(verifyItnSignature(parseItnBody(signedItn(ITN, "other")), PASS)).toBe(false);
  });

  it("rejects when the signature is missing", () => {
    const noSig = new URLSearchParams(ITN).toString();
    expect(verifyItnSignature(parseItnBody(noSig), PASS)).toBe(false);
  });

  it("is order-sensitive: an alphabetically signed body does not verify", () => {
    const sorted = [...ITN].sort(([a], [b]) => a.localeCompare(b));
    const body = new URLSearchParams([...ITN, ["signature", md5(sorted.map(([k, v]) => k + "=" + phpUrlEncode(v)).join("&") + "&passphrase=" + PASS)]]).toString();
    expect(verifyItnSignature(parseItnBody(body), PASS)).toBe(false);
  });

  it("builds the postback body without signature or passphrase", () => {
    const body = itnPostbackBody(parseItnBody(signedItn(ITN)));
    expect(body).not.toContain("signature");
    expect(body).not.toContain(PASS);
    expect(body.startsWith("m_payment_id=")).toBe(true);
  });
});

describe("PayFast checkout signature", () => {
  const data = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    return_url: "https://app.example/dashboard/billing?billing=success",
    cancel_url: "https://app.example/dashboard/billing?billing=cancelled",
    notify_url: "https://app.example/api/public/billing/webhook",
    m_payment_id: "the-table:premium:abc",
    amount: "1499.00",
    item_name: "Flavourly premium monthly subscription",
    subscription_type: "1",
    recurring_amount: "1499.00",
    frequency: "3",
    cycles: "0",
    custom_str1: "the-table",
    custom_str2: "premium",
  };

  it("signs fields in PayFast attribute order, not object or alphabetical order", () => {
    const ordered = orderCheckoutFields(data).map(([k]) => k);
    expect(ordered.indexOf("custom_str1")).toBeLessThan(ordered.indexOf("subscription_type"));
    expect(ordered.indexOf("merchant_id")).toBe(0);
    expect(ordered).not.toEqual([...ordered].sort());
  });

  it("is independent of the order keys were inserted in", () => {
    const shuffled = Object.fromEntries(Object.entries(data).reverse());
    expect(checkoutSignature(shuffled, PASS)).toBe(checkoutSignature(data, PASS));
  });

  it("skips blank values and appends the passphrase", () => {
    expect(checkoutSignature({ ...data, item_description: "" }, PASS)).toBe(checkoutSignature(data, PASS));
    expect(checkoutSignature(data, PASS)).not.toBe(checkoutSignature(data, ""));
  });

  it("puts the signature last in the redirect query", () => {
    const query = checkoutQuery(data, PASS);
    expect(query.split("&").pop()).toMatch(/^signature=[0-9a-f]{32}$/);
  });

  it("refuses unknown fields instead of mis-signing", () => {
    expect(() => checkoutSignature({ ...data, nonsense: "x" }, PASS)).toThrow(/Unknown PayFast checkout field/);
  });
});

describe("PayFast API signature", () => {
  it("sorts headers and passphrase alphabetically", () => {
    const params = { version: "v1", "merchant-id": "10000100", timestamp: "2026-10-25T10:00:00" };
    const expected = md5(
      "merchant-id=10000100&passphrase=" + phpUrlEncode(PASS) + "&timestamp=2026-10-25T10%3A00%3A00&version=v1",
    );
    expect(apiSignature(params, PASS)).toBe(expected);
  });

  it("formats timestamps without milliseconds", () => {
    expect(apiTimestamp(new Date("2026-10-25T10:00:00.123Z"))).toBe("2026-10-25T10:00:00");
  });
});

describe("PayFast source IP", () => {
  const allow = ["197.97.145.144/28", "144.126.193.139"];

  it("matches CIDR ranges and exact IPs", () => {
    expect(ipAllowed("197.97.145.150", allow)).toBe(true);
    expect(ipAllowed("144.126.193.139", allow)).toBe(true);
    expect(ipAllowed("197.97.145.200", allow)).toBe(false);
    expect(ipAllowed("1.2.3.4", allow)).toBe(false);
  });

  it("prefers the platform header and ignores a forged first X-Forwarded-For entry", () => {
    const forged = new Headers({ "x-forwarded-for": "197.97.145.150, 203.0.113.9" });
    expect(trustedClientIp(forged)).toBe("203.0.113.9");
    const cf = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "197.97.145.150" });
    expect(trustedClientIp(cf)).toBe("203.0.113.7");
    expect(ipAllowed(trustedClientIp(forged) ?? "", allow)).toBe(false);
  });
});
