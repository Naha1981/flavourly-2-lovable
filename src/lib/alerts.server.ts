/**
 * Owner-facing failure alerts. Fail-safe by contract: alerting must never
 * break the request path, so every transport error is caught and logged.
 *
 * Transports (each optional, enabled by env):
 * - ALERT_WEBHOOK_URL: POST JSON, HMAC-SHA256 signed with
 *   ALERT_WEBHOOK_SECRET (x-flavourly-signature header). HTTPS only.
 * - WhatsApp through the existing operator send path: ALERT_OWNER_PHONE +
 *   ALERT_WHATSAPP_TENANT_ID + ALERT_WHATSAPP_ACCOUNT_ID.
 *
 * A structured console.error line is always emitted, so the log pipeline
 * captures every alert even when no transport is configured.
 */
import { createHmac } from "node:crypto";

export type AlertLevel = "critical" | "warning";

export interface AlertPayload {
  key: string;
  level: AlertLevel;
  title: string;
  details?: string | undefined;
  at: string;
  product: "flavourly";
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

const DEFAULT_THROTTLE_SECONDS = 300;
const lastSentAt = new Map<string, number>();

function throttleSeconds() {
  const rawText = env("ALERT_THROTTLE_SECONDS");
  if (!rawText) return DEFAULT_THROTTLE_SECONDS;
  const raw = Number(rawText);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_THROTTLE_SECONDS;
}

export function alertConfigStatus() {
  return {
    webhook: Boolean(env("ALERT_WEBHOOK_URL")),
    whatsapp: Boolean(
      env("ALERT_OWNER_PHONE") && env("ALERT_WHATSAPP_TENANT_ID") && env("ALERT_WHATSAPP_ACCOUNT_ID"),
    ),
    throttleSeconds: throttleSeconds(),
  };
}

export function signAlertBody(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function postWebhook(payload: AlertPayload) {
  const url = env("ALERT_WEBHOOK_URL");
  if (!url) return { attempted: false as const };
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("ALERT_WEBHOOK_URL must be https.");
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = env("ALERT_WEBHOOK_SECRET");
  if (secret) headers["x-flavourly-signature"] = signAlertBody(secret, body);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("alert webhook responded " + response.status);
  return { attempted: true as const };
}

async function sendWhatsAppAlert(payload: AlertPayload) {
  const phone = env("ALERT_OWNER_PHONE");
  const tenantId = env("ALERT_WHATSAPP_TENANT_ID");
  const accountId = env("ALERT_WHATSAPP_ACCOUNT_ID");
  if (!phone || !tenantId || !accountId) return { attempted: false as const };
  const { sendText } = await import("./whatsapp.server");
  const text = (
    "Flavourly alert (" + payload.level + "): " + payload.title +
    (payload.details ? "\n" + payload.details : "")
  ).slice(0, 900);
  const result = await sendText(tenantId, accountId, phone, text);
  if (!result.ok) throw new Error(result.error ?? "operator send failed");
  return { attempted: true as const };
}

export async function sendAlert(key: string, level: AlertLevel, title: string, details?: string) {
  const payload: AlertPayload = {
    key,
    level,
    title,
    details,
    at: new Date().toISOString(),
    product: "flavourly",
  };
  // The log line is the always-on transport: every alert reaches the log pipeline.
  console.error("[flavourly-alert]", JSON.stringify(payload));

  const windowMs = throttleSeconds() * 1000;
  const last = lastSentAt.get(key) ?? 0;
  if (Date.now() - last < windowMs) return { delivered: "throttled" as const, outcomes: [] };

  const outcomes: string[] = [];
  let sent = false;
  for (const transport of [postWebhook, sendWhatsAppAlert]) {
    try {
      const result = await transport(payload);
      if (result.attempted) {
        sent = true;
        outcomes.push("sent");
      }
    } catch (error) {
      outcomes.push("failed: " + (error instanceof Error ? error.message : String(error)));
    }
  }
  if (sent) lastSentAt.set(key, Date.now());
  return { delivered: sent ? ("sent" as const) : ("unconfigured" as const), outcomes };
}

/** Run a cron body and raise a critical owner alert when it throws. */
export async function withCronAlert<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await sendAlert(
      "cron:" + name,
      "critical",
      "Cron " + name + " failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/** Test hook: clear in-memory throttle state between cases. */
export function resetAlertThrottleForTests() {
  lastSentAt.clear();
}
