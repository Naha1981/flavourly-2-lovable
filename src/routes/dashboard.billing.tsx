import { WhatsAppUsage } from "@/components/whatsapp-usage";
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { cancelPlan, getBilling } from "@/lib/billing.functions";
import { plans, MESSAGE_USAGE_FEE_NOTICE } from "@/lib/pricing";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => dashMeta("Billing", "Flavourly subscription, trial and message allowance."),
  component: BillingPage,
});

function BillingPage() {
  const { profile, ready } = useRestaurantProfile();
  const billing = useServerFn(getBilling);
  const cancel = useServerFn(cancelPlan);
  const [data, setData] = useState<Awaited<ReturnType<typeof getBilling>> | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!ready || !profile.slug) return;
    try {
      setData(await billing({ data: { tenantId: profile.slug } }));
      setError(false);
    } catch {
      setError(true);
    }
  }, [billing, profile.slug, ready]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error)
    return (
      <section role="alert" className="rounded-2xl border border-border p-5">
        <h1 className="font-display text-2xl">Billing could not load</h1>
        <p className="mt-2">No payment has been started. Retry or contact the team.</p>
        <Button className="mt-4" onClick={() => void reload()}>
          Retry billing
        </Button>
      </section>
    );
  if (!ready || !data) return <p role="status">Loading billing...</p>;

  const trialText =
    data.status === "trialing" && data.trialEndsAt
      ? "Trial ends " + new Date(data.trialEndsAt).toLocaleDateString()
      : data.status.replace("_", " ");

  return (
    <>
      <PageTitle title="Billing" sub={trialText} />
      <WhatsAppUsage tenantId={profile.slug} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="mt-1 font-display text-xl text-foreground">{data.plan}</p>
        </div>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">
        Self-serve checkout is paused during pilot acceptance. No automatic charge. Existing
        subscription records and cancellation remain available.
      </p>
      <p className="mb-5 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
        {MESSAGE_USAGE_FEE_NOTICE}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className="glass-card rounded-2xl border border-border p-5">
            <h2 className="font-display text-xl text-foreground">{plan.name}</h2>
            <p className="mt-2 font-display text-2xl text-foreground">
              {formatZAR(plan.price * 100)}
              <span className="text-sm text-muted-foreground">/venue/month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.highlight}. One venue, one number.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/contact">Confirm plan with us</Link>
            </Button>
          </article>
        ))}
      </div>

      {data.hasSubscription && (
        <Button
          variant="outline"
          className="mt-6"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await cancel({ data: { tenantId: profile.slug } });
              await reload();
            } finally {
              setBusy(false);
            }
          }}
        >
          Cancel subscription
        </Button>
      )}
    </>
  );
}
