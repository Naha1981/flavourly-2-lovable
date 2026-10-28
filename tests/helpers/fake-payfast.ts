/**
 * Fake PayFast sandbox ITN harness: builds correctly-signed ITN form bodies
 * for tests, so the full verifyPayFastWebhook path (signature, references,
 * amount, postback, DB application) can be exercised without a real PayFast
 * account or any network access.
 */
import { buildPayFastSignature } from "@/lib/billing.server";
import { TIER_MONTHLY_CENTS, type PlanTier } from "@/lib/billing/provider";

export const PF_SANDBOX_ENV = {
  PAYFAST_MERCHANT_ID: "10000100",
  PAYFAST_MERCHANT_KEY: "test-merchant-key",
  PAYFAST_PASSPHRASE: "test phrase",
  PAYFAST_SANDBOX: "true",
  PUBLIC_APP_URL: "https://app.example",
} as const;

let paymentSeq = 1_089_250;

export interface FakeItnOptions {
  tenantId: string;
  tier: PlanTier;
  status?: "COMPLETE" | "CANCELLED" | "FAILED" | string;
  pfPaymentId?: string;
  token?: string;
  amountGross?: string | null;
  paymentDate?: string;
  merchantId?: string;
  extraFields?: Record<string, string>;
}

/** A realistically-shaped, validly-signed ITN form body. */
export function buildSignedItn(options: FakeItnOptions): string {
  const data: Record<string, string> = {
    m_payment_id: options.tenantId + ":" + options.tier + ":checkout-uuid",
    pf_payment_id: options.pfPaymentId ?? String(paymentSeq++),
    payment_status: options.status ?? "COMPLETE",
    item_name: "Flavourly " + options.tier + " monthly subscription",
    item_description: "Recurring subscription",
    amount_gross:
      options.amountGross === null
        ? ""
        : (options.amountGross ?? (TIER_MONTHLY_CENTS[options.tier] / 100).toFixed(2)),
    amount_fee: "-14.97",
    amount_net: "484.03",
    custom_str1: options.tenantId,
    custom_str2: options.tier,
    merchant_id: options.merchantId ?? PF_SANDBOX_ENV.PAYFAST_MERCHANT_ID,
    token: options.token ?? "subscription-token-" + options.tenantId,
    ...(options.paymentDate ? { payment_date: options.paymentDate } : {}),
    ...(options.extraFields ?? {}),
  };
  if (options.amountGross === null) delete data["amount_gross"];
  const signature = buildPayFastSignature(data, PF_SANDBOX_ENV.PAYFAST_PASSPHRASE);
  return new URLSearchParams({ ...data, signature }).toString();
}

export function itnRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://app.example/api/public/billing/webhook", {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  });
}
