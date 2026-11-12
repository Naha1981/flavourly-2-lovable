import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans, rand } from "@/lib/mock-data";
import { MESSAGE_USAGE_FEE_NOTICE } from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Flavourly" },
      {
        name: "description",
        content:
          "Flavourly: R999, R1,500 and R2,900 per venue per month. Seven days free, no card. Higher plans subject to acceptance.",
      },
      { property: "og:title", content: "Pricing — Flavourly" },
      {
        property: "og:description",
        content: "Three single-venue plans with clear usage limits. Starter pilot enrolment first.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pb-8 pt-14 text-center sm:px-6 lg:px-8">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            7-day trial · no card
          </Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            A clear plan for your restaurant
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            R999, R1,500 or R2,900 per venue per month, month-to-month. Each plan covers one venue
            and one WhatsApp number. We are enrolling the first two venues on Starter; activation
            follows your own-number connection, auto-reply opt-in and a successful test enquiry.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border bg-card p-6 ${
                  plan.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border/70"
                }`}
              >
                {plan.popular ? (
                  <Badge className="mb-3 w-fit rounded-full text-[11px]">Most popular</Badge>
                ) : null}
                <h2 className="font-display text-xl font-semibold text-foreground">{plan.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {plan.target}
                </p>
                <p className="mt-5 font-display text-3xl font-semibold text-foreground">
                  {rand(plan.price)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="mt-2 text-sm font-medium text-primary">{plan.highlight}</p>
                <ul className="mt-5 grid flex-1 gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-foreground/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest,theme(colors.green.700))]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 rounded-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  <Link
                    to={plan.name === "Starter" ? "/signup" : "/contact"}
                    search={plan.name === "Starter" ? { plan: "starter" } : {}}
                  >
                    {plan.name === "Starter" ? "Join Starter pilot" : "Ask about this plan"}
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{MESSAGE_USAGE_FEE_NOTICE}</p>
            <p className="mt-3">
              Seven-day trial, no card. Trial allowance: up to 100 replies, counted within your
              monthly allowance. No automatic charge.
            </p>
            <p className="mt-3">
              Service replies only, within 24 hours of a customer messaging you. No cold messages,
              paid templates or campaigns. Replies stop at your allowance; extra capacity needs
              separate approval.
            </p>
            <p className="mt-3">
              Connect your own WhatsApp Business number, turn on auto-replies and run a test enquiry
              before relying on replies. Capacity-confirmed bookings, loyalty, reviews and team
              features are not included as available until they pass acceptance. A booking request
              is not a confirmed reservation.
            </p>
          </div>
          <div className="mt-12 rounded-2xl border border-border/70 bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Not sure which plan fits?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Tell us about your venue and message volume. We will confirm what is ready before you
              commit.
            </p>
            <Button asChild variant="outline" className="mt-5 rounded-full">
              <Link to="/contact">Talk to sales</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
