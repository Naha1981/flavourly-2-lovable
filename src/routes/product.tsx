import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Crown, Inbox, Radar, Send, ShieldCheck, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Pilot scope - Flavourly" },
      {
        name: "description",
        content:
          "What the Starter pilot includes, what remains paused and what still needs acceptance.",
      },
      { property: "og:title", content: "Pilot scope - Flavourly" },
      {
        property: "og:description",
        content: "Read the pilot scope and activation limits before signing up.",
      },
    ],
  }),
  component: ProductPage,
});

const engines = [
  {
    icon: Inbox,
    name: "Starter pilot scope",
    blurb: "Customer conversations and booking-request capture after activation checks.",
    points: [
      "One venue and one WhatsApp number",
      "Menu and hours enquiries",
      "A booking request is not a confirmed reservation",
    ],
  },
  {
    icon: BarChart3,
    name: "Revenue reporting - not accepted yet",
    blurb:
      "Reporting needs verified source data and a live acceptance pass before it can be offered as available.",
    points: [
      "No verified revenue promise",
      "No forecast accuracy claim",
      "Not included as available during pilot acceptance",
    ],
  },
  {
    icon: Crown,
    name: "Loyalty and VIP - not accepted yet",
    blurb: "These features are not available as an accepted pilot capability.",
    points: [
      "No automatic customer reactivation",
      "Guest data needs permission",
      "Higher plans require capacity approval",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Reviews - not accepted yet",
    blurb: "Review requests need consent and live-route verification. Sending stays paused.",
    points: [
      "No imported review-feed promise",
      "No guaranteed rating improvement",
      "No paid templates or cold messages",
    ],
  },
  {
    icon: Radar,
    name: "Market research - not accepted yet",
    blurb: "Market and competitor features need a separate acceptance pass.",
    points: [
      "No live monitoring promise",
      "No verified demand prediction",
      "No customer results claimed",
    ],
  },
  {
    icon: Send,
    name: "Campaigns and extra channels - paused",
    blurb: "Campaigns and a multi-channel inbox are not available as accepted pilot capabilities.",
    points: [
      "No cold outreach or campaigns",
      "No Instagram, Facebook or email connection promise",
      "Activation does not happen just by signing up",
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
            Pilot scope and acceptance
          </Badge>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Know what is ready before you commit.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            The Starter pilot focuses on customer conversations and booking requests. Connect your
            own WhatsApp Business number, turn on auto-replies and run a test enquiry before relying
            on replies. Other capabilities below are not accepted as available.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild className="rounded-full">
              <Link to="/signup">Start free trial</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dashboard/replies">Sign in to the AI desk</Link>
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
