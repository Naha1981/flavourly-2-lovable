import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PayFast signing helpers. Pure functions only (no DB, no env) so they can be
 * unit-tested against fixtures.
 *
 * Three different signature rules exist and they are NOT interchangeable:
 *  1. Checkout form  - fields in PayFast's documented attribute order, blank
 *                      values skipped, passphrase appended.
 *  2. ITN (webhook)  - fields in the order they were RECEIVED, signature
 *                      excluded, passphrase appended.
 *  3. REST API       - all parameters + headers sorted alphabetically.
 * Sorting alphabetically for (1) or (2) makes PayFast reject the signature.
 */

/** Attribute order from PayFast's "custom integration" form field docs. */
export const CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "notify_method",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
  "subscription_notify_email",
  "subscription_notify_webhook",
  "subscription_notify_buyer",
] as const;

/** PHP `urlencode()` compatible encoding, which PayFast uses for signatures. */
export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E");
}

export function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Returns the checkout fields in PayFast's order. Throws on unknown fields so a typo can't silently mis-sign. */
export function orderCheckoutFields(data: Record<string, string>): Array<[string, string]> {
  const known = new Set<string>(CHECKOUT_FIELD_ORDER);
  const unknown = Object.keys(data).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Error("Unknown PayFast checkout field(s): " + unknown.join(", "));
  }
  return CHECKOUT_FIELD_ORDER.filter((key) => data[key] !== undefined && data[key] !== "").map(
    (key) => [key, data[key] as string],
  );
}

function appendPassphrase(base: string, passphrase: string): string {
  return passphrase ? base + "&passphrase=" + phpUrlEncode(passphrase) : base;
}

export function encodePairs(pairs: Array<[string, string]>): string {
  return pairs.map(([key, value]) => phpUrlEncode(key) + "=" + phpUrlEncode(value)).join("&");
}

export function checkoutSignature(data: Record<string, string>, passphrase: string): string {
  return md5(appendPassphrase(encodePairs(orderCheckoutFields(data)), passphrase));
}

/** Full redirect query string for the hosted checkout: ordered fields, then signature. */
export function checkoutQuery(data: Record<string, string>, passphrase: string): string {
  const pairs = orderCheckoutFields(data);
  const signature = md5(appendPassphrase(encodePairs(pairs), passphrase));
  return encodePairs(pairs) + "&signature=" + signature;
}

/** Parses an ITN body keeping the order PayFast sent the fields in. */
export function parseItnBody(raw: string): Array<[string, string]> {
  return Array.from(new URLSearchParams(raw).entries());
}

/**
 * Verifies an ITN signature. PayFast signs the fields in received order.
 * We accept the string built with or without blank values: PayFast's own
 * sample code includes them, some libraries drop them, and both are
 * order-faithful. The passphrase (which is secret) still has to match.
 */
export function verifyItnSignature(pairs: Array<[string, string]>, passphrase: string): boolean {
  const provided = pairs.find(([key]) => key === "signature")?.[1] ?? "";
  if (!provided) return false;
  const body = pairs.filter(([key]) => key !== "signature");
  const withBlanks = md5(appendPassphrase(encodePairs(body), passphrase));
  if (safeEqual(withBlanks, provided)) return true;
  const withoutBlanks = md5(appendPassphrase(encodePairs(body.filter(([, v]) => v !== "")), passphrase));
  return safeEqual(withoutBlanks, provided);
}

/** The string PayFast's /eng/query/validate endpoint expects: received order, no signature, no passphrase. */
export function itnPostbackBody(pairs: Array<[string, string]>): string {
  return encodePairs(pairs.filter(([key]) => key !== "signature"));
}

/** REST API signature: headers + params sorted alphabetically, passphrase included. */
export function apiSignature(params: Record<string, string>, passphrase: string): string {
  const all: Record<string, string> = passphrase ? { ...params, passphrase } : { ...params };
  const keys = Object.keys(all).sort();
  return md5(keys.map((key) => phpUrlEncode(key) + "=" + phpUrlEncode(all[key] as string)).join("&"));
}

/** ISO-8601 timestamp without milliseconds, as the PayFast API requires. */
export function apiTimestamp(now = new Date()): string {
  return now.toISOString().replace(/\.\d{3}Z$/, "");
}

/**
 * Best-effort client IP using only headers a platform proxy sets itself.
 * Never uses the FIRST X-Forwarded-For entry: that value is supplied by the
 * caller and can be forged. The last entry is the one our nearest proxy added.
 */
export function trustedClientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? null;
  }
  return null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = result * 256 + n;
  }
  return result;
}

/** Matches an IPv4 address against exact IPs and CIDR ranges ("197.97.145.144/28"). */
export function ipAllowed(ip: string, allowList: string[]): boolean {
  const source = ipv4ToInt(ip);
  for (const entry of allowList) {
    const [base, bitsRaw] = entry.split("/");
    if (!base) continue;
    if (bitsRaw === undefined) {
      if (base === ip) return true;
      continue;
    }
    const bits = Number(bitsRaw);
    const baseInt = ipv4ToInt(base);
    if (source === null || baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const size = 2 ** (32 - bits);
    if (Math.floor(source / size) === Math.floor(baseInt / size)) return true;
  }
  return false;
}
