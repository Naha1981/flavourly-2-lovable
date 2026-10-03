import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  const keys = Object.keys(data).filter((key) => data[key] !== "").sort();
  const pairs = keys.map((key) => phpUrlEncode(key) + "=" + phpUrlEncode(data[key] ?? ""));
  return pairs.join("&") + (passphrase ? "&passphrase=" + phpUrlEncode(passphrase) : "");
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
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

  const data: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: appUrl + "/dashboard/billing?billing=success",
    cancel_url: appUrl + "/dashboard/billing?billing=cancelled",
    notify_url: appUrl + "/api/public/billing/webhook",
    m_payment_id: mPaymentId,
    amount: (TIER_MONTHLY_CENTS[tier] / 100).toFixed(2),
    item_name: "Flavourly " + tier + " monthly subscription",
    subscription_type: "1",
    recurring_amount: (TIER_MONTHLY_CENTS[tier] / 100).toFixed(2),
    frequency: "3",
    cycles: "0",
    custom_str1: tenantId,
    custom_str2: tier,
  };

  const signature = md5(signatureInput(data, passphrase));
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
  const data: Record<string, string> = {};
  let providedSignature = "";

  for (const [key, value] of params.entries()) {
    if (key === "signature") providedSignature = value;
    else data[key] = value;
  }

  if (!providedSignature) throw new Error("Missing PayFast signature.");
  const expected = md5(signatureInput(data, env("PAYFAST_PASSPHRASE")));
  if (!safeEqual(expected, providedSignature)) throw new Error("PayFast signature mismatch.");

  if (data["merchant_id"] !== env("PAYFAST_MERCHANT_ID")) {
    throw new Error("PayFast merchant mismatch.");
  }

  const amount = Number(data["amount_gross"] ?? "0");
  const tier = tierFromPaymentId(data["m_payment_id"] ?? "");
  const tenantId = data["custom_str1"] || data["m_payment_id"]?.split(":")[0] || "";
  if (!tenantId || !tier) throw new Error("PayFast payload missing tenant/tier.");

  const expectedAmount = TIER_MONTHLY_CENTS[tier] / 100;
  if (Math.abs(amount - expectedAmount) > 0.01) throw new Error("PayFast amount mismatch.");

  const status = (data["payment_status"] ?? "").toLowerCase();
  const c = supabaseAdmin;
  const { data: tenant } = await c.from("tenant_profiles")
    .select("tenant_id, plan_status, payfast_subscription_token")
    .eq("tenant_id", tenantId).maybeSingle();
  if (!tenant) throw new Error("Unknown Flavourly tenant.");

  if (status === "complete") {
    await c.from("tenant_profiles").update({
      plan_tier: tier,
      plan_status: "active",
      payfast_customer_token: data["token"] || null,
      payfast_subscription_token: data["token"] || null,
    }).eq("tenant_id", tenantId);
    return { ok: true as const, tenantId, status: "active" as const };
  }

  if (status === "cancelled") {
    await c.from("tenant_profiles").update({ plan_status: "canceled" })
      .eq("tenant_id", tenantId);
    return { ok: true as const, tenantId, status: "canceled" as const };
  }

  if (status === "failed") {
    await c.from("tenant_profiles").update({ plan_status: "past_due" })
      .eq("tenant_id", tenantId);
    return { ok: true as const, tenantId, status: "past_due" as const };
  }

  return { ok: true as const, tenantId, status: "ignored" as const };
}

export function assertPayFastSource(request: Request) {
  const live = env("PAYFAST_SANDBOX") !== "true";
  if (!live) return;
  const allow = env("PAYFAST_ALLOWED_IPS").split(",").map((x) => x.trim()).filter(Boolean);
  if (allow.length === 0) throw new Error("PAYFAST_ALLOWED_IPS must be configured for live ITN verification.");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const remote = request.headers.get("x-real-ip")?.trim();
  const source = forwarded || remote;
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
