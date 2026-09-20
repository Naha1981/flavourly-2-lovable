import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/company")({
  head: () => ({
    meta: [
      { title: "About NahaLabs — Flavourly" },
      {
        name: "description",
        content:
          "Flavourly is built in Johannesburg by NahaLabs for South African restaurants, with local payments, local voice and local support.",
      },
      { property: "og:title", content: "About NahaLabs — Flavourly" },
      {
        property: "og:description",
        content: "Why we built an AI revenue employee for South African restaurants.",
      },
    ],
  }),
  component: CompanyPage,
});

const values = [
  {
    title: "Revenue, or it didn't happen",
    body: "Every screen in Flavourly ties back to money in the till. If a feature can't show its worth in rand, it doesn't ship.",
  },
  {
    title: "Built for the floor, not the boardroom",
    body: "Managers use this mid-service with one hand. Big taps, plain words, nothing buried three menus deep.",
  },
  {
    title: "South African by default",
    body: "ZAR pricing, local payment rails, WhatsApp first, and a voice that sounds like someone who actually lives here.",
  },
  {
    title: "A human always has the last word",
    body: "The AI drafts. Your team approves. Nothing awkward goes out to a guest without a person seeing it first.",
  },
];

function CompanyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Built in Johannesburg
          </Badge>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            We got tired of watching good restaurants lose money at 22:00
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            NahaLabs builds software for businesses that run on shifts. Flavourly started when a
            restaurateur friend showed us 200 unanswered WhatsApp messages from a single weekend —
            every one of them a table somebody else got.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            {values.map((value) => (
              <article key={value.title} className="rounded-2xl border border-border/70 bg-card p-7">
                <h2 className="font-display text-lg font-semibold text-foreground">{value.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border/70 bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Want to talk to a human?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              We answer our own messages. Usually within the hour, during South African trading
              times.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
