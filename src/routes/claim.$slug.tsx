import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { demoRestaurant, rand, revenue } from "@/lib/mock-data";

export const Route = createFileRoute("/claim/$slug")({
  head: () => ({
    meta: [
      { title: "Claim your restaurant app — Flavourly" },
      {
        name: "description",
        content:
          "Your Flavourly workspace is already built with your branding, menu and reviews. Claim it and go live in minutes.",
      },
      { property: "og:title", content: "Claim your restaurant app — Flavourly" },
      {
        property: "og:description",
        content: "We built your AI revenue employee already. Open it and see.",
      },
    ],
  }),
  component: ClaimPage,
});

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ClaimPage() {
  const { slug } = Route.useParams();
  const venue = titleFromSlug(slug) || demoRestaurant.name;

  const included = [
    "Your menu, hours and branding already loaded",
    "WhatsApp host ready to answer tonight",
    "Last 90 days of your public reviews imported",
    "Live 14-day trial, no card, cancel any time",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/">
            <Logo size="md" />
          </Link>
          <Badge variant="secondary" className="rounded-full text-[11px]">
            Private preview for {venue}
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6">
        <Badge className="rounded-full px-3 py-1 text-xs">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Already built for you
        </Badge>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {venue}, your app is waiting
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          We studied your website, menu and reviews and set the whole thing up. Nothing to install,
          nothing to configure — open it and it's yours.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-border/70 bg-card p-7">
            <h2 className="font-display text-lg font-semibold text-foreground">
              What's inside already
            </h2>
            <ul className="mt-4 grid gap-3">
              {included.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-foreground/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-7 w-full rounded-full">
              <Link to="/signup" search={{ plan: "premium" }}>
                Claim your app <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Takes about two minutes. No card, no contract.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-7">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              A peek at your first dashboard
            </p>
            <dl className="mt-5 grid gap-5">
              <Stat label="Yesterday's verified revenue" value={rand(revenue.yesterday)} />
              <Stat label="Covers served" value={String(revenue.covers)} />
              <Stat label="Average check" value={rand(revenue.averageCheck)} />
              <Stat label="Recovered this month" value={rand(revenue.recovered)} />
            </dl>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Sample figures shown until we connect your till — usually within a day of claiming.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}
