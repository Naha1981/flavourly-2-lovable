import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { db } from "./db.server";
import {
  canUseService,
  isPlanTier,
  PLAN_TIERS,
  quotaDecision,
  TIER_HOURLY_MESSAGES,
  TIER_MONTHLY_CENTS,
  TIER_MONTHLY_MESSAGES,
  type BillingStatus,
  type PlanTier,
} from "./billing/provider";

const LIVE_BASE_URL = "https://www.payfast.co.za/eng/process";
const SANDBOX_BASE_URL = "https://sandbox.payfast.co.za/eng/process";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function phpUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+")
    .replace(/~/g, "%7E");
}

function signatureInput(data: Record<string, string>, passphrase: string) {
  // Checkout signatures follow PayFast's documented form-field order. ITN
  // signatures use the insertion order preserved while parsing the posted body.
  const pairs = Object.keys(data)
    .filter((key) => (data[key] ?? "").trim() !== "")
    .map((key) => key + "=" + phpUrlEncode(data[key] ?? ""));
  return pairs.join("&") + (passphrase ? "&passphrase=" + phpUrlEncode(passphrase) : "");
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

/** PayFast custom-checkout/ITN MD5 signature (not the alphabetically sorted API signature). */
export function buildPayFastSignature(data: Record<string, string>, passphrase: string) {
  return md5(signatureInput(data, passphrase.trim()));
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function publicAppUrl() {
  const value = env("PUBLIC_APP_URL");
  if (!value) throw new Error("PUBLIC_APP_URL is required for PayFast billing.");
  return value.replace(/\/$/, "");
}

function assertPayFastConfigured() {
  if (!env("PAYFAST_MERCHANT_ID") || !env("PAYFAST_MERCHANT_KEY")) {
    throw new Error("PayFast merchant credentials are not configured.");
  }
  // Flavourly creates recurring subscriptions; PayFast requires a passphrase
  // for subscription/tokenisation signatures in both sandbox and live modes.
  if (!env("PAYFAST_PASSPHRASE")) {
    throw new Error("PAYFAST_PASSPHRASE is required for subscription billing.");
  }
}

function tierFromPaymentId(value: string): PlanTier | null {
  const parts = value.split(":");
  return isPlanTier(parts[1]) ? parts[1] : null;
}

export async function getBillingStatus(tenantId: string) {
  const c = supabaseAdmin;
  const { data: tenant, error } = await c.from("tenant_profiles")
    .select("plan_tier, plan_status, trial_ends_at, payfast_subscription_token")
    .eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("Restaurant billing profile not found.");

  const plan = (tenant.plan_tier as PlanTier) ?? "starter";
  const status = (tenant.plan_status as BillingStatus) ?? "trialing";

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const hourStart = new Date(Date.now() - 3_600_000);

  const { count: monthlyReserved } = await c.from("outbox_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("sent_at", monthStart.toISOString())
    .eq("status", "sent");

  const { count: hourlyReserved } = await c.from("outbox_jobs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("sent_at", hourStart.toISOString())
    .eq("status", "sent");

  return {
    plan,
    status,
    trialEndsAt: tenant.trial_ends_at as string | null,
    monthlyReserved: monthlyReserved ?? 0,
    hourlyReserved: hourlyReserved ?? 0,
    monthlyLimit: TIER_MONTHLY_MESSAGES[plan],
    hourlyLimit: TIER_HOURLY_MESSAGES[plan],
    monthlyCents: TIER_MONTHLY_CENTS[plan],
    hasSubscription: Boolean(tenant.payfast_subscription_token),
    serviceAllowed: canUseService(status, tenant.trial_ends_at as string | null),
  };
}

export async function assertCanQueueMessage(tenantId: string) {
  const billing = await getBillingStatus(tenantId);
  if (!billing.serviceAllowed) {
    throw new Error("Messaging is paused because this restaurant's trial or subscription is not active.");
  }
  const decision = quotaDecision(billing.plan, {
    monthlyReserved: billing.monthlyReserved,
    hourlyReserved: billing.hourlyReserved,
  });
  if (!decision.allowed) {
    if (decision.reason === "monthly_quota_exceeded") {
      throw new Error("Monthly message quota reached for the current plan.");
    }
    throw new Error("Hourly message rate limit reached for the current plan.");
  }
  return billing;
}

export async function createCheckout(tenantId: string, tier: PlanTier) {
  assertPayFastConfigured();
  if (!PLAN_TIERS.includes(tier)) throw new Error("Unknown billing tier.");

  const appUrl = publicAppUrl();
  const sandbox = env("PAYFAST_SANDBOX") === "true";
  const merchantId = env("PAYFAST_MERCHANT_ID");
  const merchantKey = env("PAYFAST_MERCHANT_KEY");
  const passphrase = env("PAYFAST_PASSPHRASE");
  const base = sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  const mPaymentId = tenantId + ":" + tier + ":" + randomUUID();

  // Keep this object in PayFast's documented custom form field order.
  // Do not sort these keys: the API signing format is different.
  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: appUrl + "/dashboard/billing?billing=success",
    cancel_url: appUrl + "/dashboard/billing?billing=cancelled",
    notify_url: appUrl + "/api/public/billing/webhook",
    m_payment_id: mPaymentId,
    amount: (TIER_MONTHLY_CENTS[tier] / 100).toFixed(2),
    item_name: "Flavourly " + tier + " monthly subscription",
    custom_str1: tenantId,
    custom_str2: tier,
    subscription_type: "1",
    recurring_amount: (TIER_MONTHLY_CENTS[tier] / 100).toFixed(2),
    frequency: "3",
    cycles: "0",
  };

  const signature = buildPayFastSignature(data, passphrase);
  const query = Object.entries({ ...data, signature })
    .map(([key, value]) => phpUrlEncode(key) + "=" + phpUrlEncode(value))
    .join("&");

  return { redirectUrl: base + "?" + query };
}

export async function cancelSubscription(tenantId: string) {
  assertPayFastConfigured();
  const c = supabaseAdmin;
  const { data: tenant } = await c.from("tenant_profiles")
    .select("payfast_subscription_token").eq("tenant_id", tenantId).maybeSingle();

  await c.from("tenant_profiles").update({ plan_status: "canceled" }).eq("tenant_id", tenantId);

  if (!tenant?.payfast_subscription_token) return;
  const sandbox = env("PAYFAST_SANDBOX") === "true";
  const endpoint = (sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za")
    + "/subscriptions/" + encodeURIComponent(tenant.payfast_subscription_token) + "/update";

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json", version: "v1" },
    body: JSON.stringify({
      merchantId: env("PAYFAST_MERCHANT_ID"),
      passphrase: env("PAYFAST_PASSPHRASE"),
      status: 2,
    }),
  });
  if (!response.ok) console.error("PayFast cancel request failed", response.status);
}

export async function verifyPayFastWebhook(request: Request) {
  assertPayFastConfigured();
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const data: Record<string, string> = Object.create(null) as Record<string, string>;
  let providedSignature = "";
  let signatureCount = 0;

  for (const [key, value] of params.entries()) {
    if (key === "signature") {
      signatureCount += 1;
      providedSignature = value;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error("Duplicate PayFast field.");
    }
    data[key] = value;
  }

  if (signatureCount !== 1 || !providedSignature) throw new Error("Missing or duplicate PayFast signature.");
  const expected = buildPayFastSignature(data, env("PAYFAST_PASSPHRASE"));
  if (!safeEqual(expected, providedSignature)) throw new Error("PayFast signature mismatch.");

  if (data["merchant_id"] !== env("PAYFAST_MERCHANT_ID")) {
    throw new Error("PayFast merchant mismatch.");
  }

  const paymentId = data["m_payment_id"] ?? "";
  const tier = tierFromPaymentId(paymentId);
  const paymentTenant = paymentId.split(":")[0] ?? "";
  const tenantId = data["custom_str1"] || paymentTenant;
  if (
    !tenantId ||
    !tier ||
    paymentTenant !== tenantId ||
    !/^[a-z0-9-]{1,80}$/.test(tenantId) ||
    (data["custom_str2"] && data["custom_str2"] !== tier)
  ) {
    throw new Error("PayFast payload has an invalid tenant/tier reference.");
  }

  const pfPaymentId = data["pf_payment_id"] ?? "";
  if (!/^\d+$/.test(pfPaymentId)) throw new Error("PayFast payload missing transaction id.");
  const subscriptionToken = data["token"] ?? "";
  if (!subscriptionToken) throw new Error("PayFast payload missing subscription token.");

  const status = (data["payment_status"] ?? "").toUpperCase();
  const recognisedStatus = ["COMPLETE", "CANCELLED", "FAILED"].includes(status);
  if (!recognisedStatus) {
    // Still verify the notification with PayFast before ignoring an unknown status.
  }

  const amountText = data["amount_gross"] ?? "";
  if (amountText) {
    const amount = Number(amountText);
    const expectedAmount = TIER_MONTHLY_CENTS[tier] / 100;
    if (!Number.isFinite(amount) || Math.abs(amount - expectedAmount) > 0.01) {
      throw new Error("PayFast amount mismatch.");
    }
  } else if (status !== "CANCELLED") {
    throw new Error("PayFast payload missing gross amount.");
  }

  const sandbox = env("PAYFAST_SANDBOX") === "true";
  const validationUrl = (sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za")
    + "/eng/query/validate";
  const postback = new URLSearchParams(Object.entries(data)).toString();
  const validation = await fetch(validationUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: postback,
    signal: AbortSignal.timeout(10_000),
  });
  const validationBody = (await validation.text()).trim();
  if (!validation.ok || validationBody !== "VALID") {
    throw new Error("PayFast postback validation failed.");
  }

  if (!recognisedStatus) return { ok: true as const, tenantId, status: "ignored" as const };

  const occurredAtText = data["payment_date"];
  const occurredAtMs = occurredAtText ? Date.parse(occurredAtText) : Number.NaN;
  const eventAt = Number.isFinite(occurredAtMs) ? new Date(occurredAtMs).toISOString() : new Date().toISOString();
  const c = await db();
  const { data: applied, error } = await c.rpc("apply_payfast_itn", {
    p_pf_payment_id: pfPaymentId,
    p_tenant_id: tenantId,
    p_subscription_token: subscriptionToken,
    p_payment_status: status,
    p_event_at: eventAt,
    p_tier: tier,
    p_customer_token: subscriptionToken,
  });
  if (error) throw new Error("PayFast ITN could not be applied: " + error.message);

  const result = Array.isArray(applied) ? applied[0] : applied;
  const outcome = result && typeof result === "object" && "outcome" in result
    ? String(result.outcome)
    : "ignored";
  return {
    ok: true as const,
    tenantId,
    status: outcome,
    replay: outcome === "duplicate",
  };
}

export function assertPayFastSource(request: Request) {
  // The deployed target is Cloudflare. Only trust the platform-provided source
  // IP header; X-Forwarded-For can contain client-controlled values.
  const allow = env("PAYFAST_ALLOWED_IPS").split(",").map((x) => x.trim()).filter(Boolean);
  if (allow.length === 0) {
    throw new Error("PAYFAST_ALLOWED_IPS must be configured for PayFast ITN verification.");
  }
  const source = request.headers.get("cf-connecting-ip")?.trim();
  if (!source || !allow.includes(source)) throw new Error("PayFast source IP rejected.");
}

export async function assertCanSendNow(tenantId: string) {
  const billing = await getBillingStatus(tenantId);
  if (!billing.serviceAllowed) {
    throw new Error("Messaging is paused because the restaurant trial or subscription is not active.");
  }
  const decision = quotaDecision(billing.plan, {
    monthlyReserved: billing.monthlyReserved,
    hourlyReserved: billing.hourlyReserved,
  });
  if (!decision.allowed) {
    throw new Error(
      decision.reason === "monthly_quota_exceeded"
        ? "Monthly message quota reached for the current Flavourly plan."
        : "Hourly message rate limit reached for the current Flavourly plan.",
    );
  }
  return billing;
}
