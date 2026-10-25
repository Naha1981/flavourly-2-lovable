import { randomUUID } from "node:crypto";

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
import {
  apiSignature,
  apiTimestamp,
  checkoutQuery,
  ipAllowed,
  itnPostbackBody,
  parseItnBody,
  trustedClientIp,
  verifyItnSignature,
} from "./payfast.server";

const LIVE_BASE_URL = "https://www.payfast.co.za/eng/process";
const SANDBOX_BASE_URL = "https://sandbox.payfast.co.za/eng/process";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function publicAppUrl() {
  const value = env("PUBLIC_APP_URL");
  if (!value) throw new Error("PUBLIC_APP_URL is required for PayFast billing.");
  return value.replace(/\/$/, "");
}

export function isPayFastSandbox() {
  return env("PAYFAST_SANDBOX") === "true";
}

function assertPayFastConfigured() {
  if (!env("PAYFAST_MERCHANT_ID") || !env("PAYFAST_MERCHANT_KEY")) {
    throw new Error("PayFast merchant credentials are not configured.");
  }
  // Without a passphrase the signature is an MD5 of public values and anyone
  // can forge a payment notification. Live mode must therefore have one.
  if (!isPayFastSandbox() && !env("PAYFAST_PASSPHRASE")) {
    throw new Error("PAYFAST_PASSPHRASE is required when PAYFAST_SANDBOX is not 'true'.");
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

  const query = checkoutQuery(data, passphrase);

  return { redirectUrl: base + "?" + query };
}

async function cancelAtPayFast(token: string) {
  const timestamp = apiTimestamp();
  const merchantId = env("PAYFAST_MERCHANT_ID");
  const signature = apiSignature(
    { "merchant-id": merchantId, version: "v1", timestamp },
    env("PAYFAST_PASSPHRASE"),
  );
  const url =
    "https://api.payfast.co.za/subscriptions/" +
    encodeURIComponent(token) +
    "/cancel" +
    (isPayFastSandbox() ? "?testing=true" : "");
  const response = await fetch(url, {
    method: "PUT",
    headers: { "merchant-id": merchantId, version: "v1", timestamp, signature },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error("PayFast refused to cancel the subscription (HTTP " + response.status + ").");
  }
}

export async function cancelSubscription(tenantId: string) {
  assertPayFastConfigured();
  const c = supabaseAdmin;
  const { data: tenant } = await c.from("tenant_profiles")
    .select("payfast_subscription_token").eq("tenant_id", tenantId).maybeSingle();

  // Cancel at PayFast FIRST. If that fails we must not tell the restaurant it
  // is cancelled while PayFast keeps charging their card.
  if (tenant?.payfast_subscription_token) {
    await cancelAtPayFast(tenant.payfast_subscription_token);
  }
  const { error } = await c.from("tenant_profiles").update({ plan_status: "canceled" }).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

/** Asks PayFast to confirm it really sent this notification. */
async function postbackValidate(pairs: Array<[string, string]>, fetchImpl: typeof fetch) {
  const host = isPayFastSandbox() ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
  const response = await fetchImpl(host + "/eng/query/validate", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: itnPostbackBody(pairs),
    signal: AbortSignal.timeout(8_000),
  });
  const text = (await response.text()).trim();
  if (!response.ok || text !== "VALID") throw new Error("PayFast postback validation failed.");
}

export type PayFastResult =
  | { ok: true; tenantId: string; status: "active" | "canceled" | "past_due" | "ignored" | "duplicate" | "stale" };

export async function verifyPayFastWebhook(
  request: Request,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<PayFastResult> {
  assertPayFastConfigured();
  const raw = await request.text();
  const pairs = parseItnBody(raw);

  if (!verifyItnSignature(pairs, env("PAYFAST_PASSPHRASE"))) {
    throw new Error("PayFast signature missing or mismatched.");
  }
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) if (key !== "signature") data[key] = value;

  if (data["merchant_id"] !== env("PAYFAST_MERCHANT_ID")) {
    throw new Error("PayFast merchant mismatch.");
  }

  const amount = Number(data["amount_gross"] ?? "0");
  const tier = tierFromPaymentId(data["m_payment_id"] ?? "");
  const tenantId = data["custom_str1"] || data["m_payment_id"]?.split(":")[0] || "";
  if (!tenantId || !tier) throw new Error("PayFast payload missing tenant/tier.");
  const idTenant = data["m_payment_id"]?.split(":")[0];
  if (idTenant && idTenant !== tenantId) throw new Error("PayFast tenant fields disagree.");

  const expectedAmount = TIER_MONTHLY_CENTS[tier] / 100;
  if (Math.abs(amount - expectedAmount) > 0.01) throw new Error("PayFast amount mismatch.");

  await postbackValidate(pairs, deps.fetchImpl ?? fetch);

  const status = (data["payment_status"] ?? "").toLowerCase();
  const pfPaymentId = data["pf_payment_id"] ?? "";
  const c = supabaseAdmin;
  const events = await db();

  const { data: tenant } = await c.from("tenant_profiles")
    .select("tenant_id, plan_status, payfast_subscription_token")
    .eq("tenant_id", tenantId).maybeSingle();
  if (!tenant) throw new Error("Unknown Flavourly tenant.");

  // Replay protection: the same PayFast payment + status is applied once.
  if (pfPaymentId) {
    const { data: seen, error: seenError } = await events.from("billing_events")
      .select("id").eq("pf_payment_id", pfPaymentId).eq("payment_status", status).maybeSingle();
    if (seenError) throw new Error("billing_events lookup failed: " + seenError.message);
    if (seen) return { ok: true, tenantId, status: "duplicate" };
  }

  const record = async (applied: string) => {
    if (!pfPaymentId) return;
    await events.from("billing_events").upsert(
      {
        tenant_id: tenantId,
        pf_payment_id: pfPaymentId,
        payment_status: status,
        applied_status: applied,
        subscription_token: data["token"] || null,
        amount_gross: Number.isFinite(amount) ? amount : null,
      },
      { onConflict: "pf_payment_id,payment_status", ignoreDuplicates: true },
    );
  };

  if (status === "complete") {
    // A late COMPLETE for a subscription we already cancelled must not revive it.
    const token = data["token"] || null;
    if (tenant.plan_status === "canceled" && token && token === tenant.payfast_subscription_token) {
      await record("stale");
      return { ok: true, tenantId, status: "stale" };
    }
    const { error } = await c.from("tenant_profiles").update({
      plan_tier: tier,
      plan_status: "active",
      payfast_customer_token: token,
      payfast_subscription_token: token,
    }).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    await record("active");
    return { ok: true, tenantId, status: "active" };
  }

  if (status === "cancelled") {
    const { error } = await c.from("tenant_profiles").update({ plan_status: "canceled" }).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    await record("canceled");
    return { ok: true, tenantId, status: "canceled" };
  }

  if (status === "failed") {
    // A failed renewal must not downgrade a tenant that was already cancelled.
    if (tenant.plan_status === "canceled") {
      await record("stale");
      return { ok: true, tenantId, status: "stale" };
    }
    const { error } = await c.from("tenant_profiles").update({ plan_status: "past_due" }).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    await record("past_due");
    return { ok: true, tenantId, status: "past_due" };
  }

  await record("ignored");
  return { ok: true, tenantId, status: "ignored" };
}

export function assertPayFastSource(request: Request) {
  if (isPayFastSandbox()) return;
  const allow = env("PAYFAST_ALLOWED_IPS").split(",").map((x) => x.trim()).filter(Boolean);
  if (allow.length === 0) throw new Error("PAYFAST_ALLOWED_IPS must be configured for live ITN verification.");
  const source = trustedClientIp(request.headers);
  if (!source || !ipAllowed(source, allow)) throw new Error("PayFast source IP rejected.");
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
