import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Crown,
  Inbox,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "The six engines — Flavourly" },
      {
        name: "description",
        content:
          "Inside Flavourly: revenue intelligence, the VIP engine, reputation shield, market radar, marketing autopilot and the AI inbox.",
      },
      { property: "og:title", content: "The six engines — Flavourly" },
      {
        property: "og:description",
        content: "What Flavourly actually does for your restaurant, engine by engine.",
      },
    ],
  }),
  component: ProductPage,
});

const engines = [
  {
    icon: BarChart3,
    name: "Revenue Intelligence",
    blurb:
      "Yesterday's verified revenue, this week's forecast and the single move that fixes a slow patch. No vanity numbers.",
    points: [
      "Verified takings, covers and average check",
      "Seven-day forecast against actuals",
      "One recommended action each morning",
    ],
  },
  {
    icon: Crown,
    name: "VIP Engine",
    blurb:
      "Knows who is walking in tonight, what they drink, what they spent and why they matter.",
    points: [
      "Tonight's VIP list before service",
      "Lifetime value and visit history",
      "Quiet nudges for guests going cold",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Reputation Shield",
    blurb:
      "A one-star lands at 23:00. The apology is drafted, in your voice, before you wake up.",
    points: [
      "Google, TripAdvisor and Facebook in one feed",
      "Drafted replies you approve in a tap",
      "Recovery offers for guests worth saving",
    ],
  },
  {
    icon: Radar,
    name: "Market Radar",
    blurb: "Watches the restaurants around you so you hear about their moves first.",
    points: [
      "Competitor menu and price changes",
      "Scored gaps in your area",
      "Demand trends by suburb",
    ],
  },
  {
    icon: Send,
    name: "Marketing Autopilot",
    blurb: "Fills quiet Tuesdays by messaging exactly the right people, not everybody.",
    points: [
      "Segments built from real spend",
      "Campaigns you approve, then forget",
      "Revenue attributed per send",
    ],
  },
  {
    icon: Inbox,
    name: "AI Inbox",
    blurb:
      "WhatsApp, Instagram, Facebook and email in one thread, answered in seconds, day or night.",
    points: [
      "Bookings captured and confirmed",
      "FAQ answers in your house voice",
      "Complaints escalated to a human",
    ],
  },
];

function ProductPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Six engines, one employee
          </Badge>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Everything a great front-of-house manager does. At 2am. Without a shift.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Flavourly is not a chatbot bolted onto a booking form. It's six engines that share one
            memory of every guest who has ever eaten with you.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="rounded-full">
              <Link to="/signup">Start free trial</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dashboard/replies">Try the reply writer</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {engines.map((engine) => (
              <article
                key={engine.name}
                className="rounded-2xl border border-border/70 bg-card p-6 transition-shadow hover:shadow-md"
              >
                <engine.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {engine.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{engine.blurb}</p>
                <ul className="mt-4 grid gap-2">
                  {engine.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-foreground/85">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
