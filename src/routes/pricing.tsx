import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans, rand } from "@/lib/mock-data";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Flavourly" },
      {
        name: "description",
        content:
          "Flavourly plans from R499 a month for takeaways to R19,999 for restaurant groups. 14-day free trial, no card needed.",
      },
      { property: "og:title", content: "Pricing — Flavourly" },
      {
        property: "og:description",
        content: "Five plans, from single takeaway to multi-location group. Prices in ZAR, excl. VAT.",
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
            14-day free trial · no card
          </Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Pay for a shift, not a salary
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            One missed booking a week costs more than Starter. Every plan includes the AI inbox,
            setup help from a real person, and a month-to-month agreement.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3 xl:grid-cols-5">
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
                  <Link to="/signup" search={{ plan: plan.name.toLowerCase() }}>
                    Start free trial
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border/70 bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Not sure which plan fits?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Tell us how many covers you do on a Saturday and we'll tell you honestly which plan
              pays for itself fastest.
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
