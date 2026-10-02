import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { cancelPlan, getBilling, startCheckout } from "@/lib/billing.functions";
import { TIER_MONTHLY_MESSAGES, TIER_HOURLY_MESSAGES, type PlanTier } from "@/lib/billing/provider";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => dashMeta("Billing", "Flavourly subscription, trial and message allowance."),
  component: BillingPage,
});

const tiers: PlanTier[] = ["starter", "casual", "premium", "signature", "group"];

function BillingPage() {
  const { profile, ready } = useRestaurantProfile();
  const billing = useServerFn(getBilling);
  const checkout = useServerFn(startCheckout);
  const cancel = useServerFn(cancelPlan);
  const [data, setData] = useState<Awaited<ReturnType<typeof getBilling>> | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (ready) setData(await billing({ data: { tenantId: profile.slug } }));
  }, [billing, profile.slug, ready]);

  useEffect(() => { void reload(); }, [reload]);

  if (!ready || !data) return null;

  const trialText = data.status === "trialing" && data.trialEndsAt
    ? "Trial ends " + new Date(data.trialEndsAt).toLocaleDateString()
    : data.status.replace("_", " ");

  const choose = async (tier: PlanTier) => {
    setBusy(true);
    try {
      const result = await checkout({ data: { tenantId: profile.slug, tier } });
      window.location.href = result.redirectUrl;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Billing" sub={trialText} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-xl text-foreground">{data.plan}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Messages this month</p>
          <p className="mt-1 font-display text-xl text-foreground">
            {data.monthlyReserved.toLocaleString()} / {data.monthlyLimit === Infinity ? "∞" : data.monthlyLimit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">This hour</p>
          <p className="mt-1 font-display text-xl text-foreground">{data.hourlyReserved.toLocaleString()} / {data.hourlyLimit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiers.map((tier) => (
          <article key={tier} className={`glass-card rounded-2xl border p-5 ${data.plan === tier ? "border-primary" : "border-border"}`}>
            <h2 className="font-display text-xl text-foreground">{tier}</h2>
            <p className="mt-2 font-display text-2xl text-foreground">{formatZAR(({ starter: 49900, casual: 149900, premium: 399900, signature: 799900, group: 1999900 } as Record<PlanTier, number>)[tier])}<span className="text-sm text-muted-foreground">/month</span></p>
            <p className="mt-2 text-sm text-muted-foreground">
              {TIER_MONTHLY_MESSAGES[tier] === Infinity ? "Unlimited" : TIER_MONTHLY_MESSAGES[tier].toLocaleString()} messages/month · {TIER_HOURLY_MESSAGES[tier].toLocaleString()}/hour
            </p>
            <Button className="mt-4 w-full" disabled={busy || data.plan === tier} onClick={() => void choose(tier)}>
              {data.plan === tier ? "Current plan" : "Choose plan"}
            </Button>
          </article>
        ))}
      </div>

      {data.hasSubscription && (
        <Button variant="outline" className="mt-6" disabled={busy} onClick={async () => { setBusy(true); try { await cancel({ data: { tenantId: profile.slug } }); await reload(); } finally { setBusy(false); } }}>
          Cancel subscription
        </Button>
      )}
    </>
  );
}
