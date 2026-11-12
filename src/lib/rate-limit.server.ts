/**
 * Best-effort fixed-window rate limiter for public endpoints (Definition of
 * Done, Gate B). In-memory and per-isolate: on a multi-isolate serverless
 * deployment each isolate counts independently, so this blunts abuse from a
 * single source rather than enforcing a hard global quota. That is the
 * documented abuse note for the guest claim endpoints, whose 128-bit tokens
 * already make guessing infeasible.
 *
 * Keyed by the platform's trusted client-IP header (cf-connecting-ip on the
 * Cloudflare target), never by the client-controlled X-Forwarded-For.
 */
import { getRequest } from "@tanstack/react-start/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Visible for tests: clear all limiter state. */
export function resetRateLimitsForTests() {
  buckets.clear();
}

function clientKey(scope: string): string {
  const ip =
    getRequest()?.headers.get("cf-connecting-ip")?.trim() ||
    // Local/dev fallback: no trusted header, all callers share one bucket.
    "unknown";
  return scope + ":" + ip;
}

/**
 * Returns true when the call is within the limit and records it; false when
 * the caller exceeded `limit` calls in the current `windowMs` window.
 */
export function allowRateLimited(scope: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const key = clientKey(scope);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Bound memory: drop expired buckets lazily on growth.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export const rateLimitedResponse = () =>
  new Response(JSON.stringify({ error: "Too many attempts. Try again in a minute." }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
