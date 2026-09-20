import { createFileRoute, Link } from "@tanstack/react-router";
import { Quote, TrendingUp } from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "Customer stories — Flavourly" },
      {
        name: "description",
        content:
          "How South African restaurants use Flavourly to recover missed bookings, defend their rating and fill quiet weeknights.",
      },
      { property: "og:title", content: "Customer stories — Flavourly" },
      {
        property: "og:description",
        content: "Real kitchens, real numbers: what changed after Flavourly started answering.",
      },
    ],
  }),
  component: StoriesPage,
});

const stories = [
  {
    venue: "Marble",
    city: "Rosebank, Johannesburg",
    headline: "R38,200 of bookings that used to ring out",
    quote:
      "We were losing tables every night after 21:00 because nobody was on the phone. Flavourly picked them all up. The first month paid for two years.",
    person: "Warren, Owner",
    stats: [
      { label: "Recovered revenue", value: "R38,200" },
      { label: "Median reply time", value: "4 min" },
    ],
  },
  {
    venue: "Coobs",
    city: "Linden, Johannesburg",
    headline: "Rating back to 4.7 in eleven weeks",
    quote:
      "Every review gets an answer now, in my voice, before I've had coffee. Guests notice. Two one-stars turned into return visits.",
    person: "Lerato, General Manager",
    stats: [
      { label: "Rating", value: "4.4 → 4.7" },
      { label: "Response rate", value: "100%" },
    ],
  },
  {
    venue: "Sotano",
    city: "Mouille Point, Cape Town",
    headline: "Tuesdays went from 40 covers to 96",
    quote:
      "It messaged the exact people who hadn't been in for a month, not the whole list. My regulars didn't feel spammed, they felt remembered.",
    person: "Daniel, Operations",
    stats: [
      { label: "Tuesday covers", value: "+140%" },
      { label: "Campaign revenue", value: "R19,600" },
    ],
  },
];

function StoriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6 lg:px-8">
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Customer stories
          </Badge>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            The proof is in the takings
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Three kitchens, three problems, one AI employee. Numbers below are from their own
            dashboards.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {stories.map((story) => (
              <article
                key={story.venue}
                className="flex flex-col rounded-2xl border border-border/70 bg-card p-7"
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {story.venue} · {story.city}
                </p>
                <h2 className="mt-3 font-display text-xl font-semibold leading-snug text-foreground">
                  {story.headline}
                </h2>
                <Quote className="mt-5 h-5 w-5 text-primary" strokeWidth={1.5} />
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  "{story.quote}"
                </p>
                <p className="mt-4 text-sm font-medium text-foreground">{story.person}</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border/70 pt-5">
                  {story.stats.map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        {stat.label}
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-border/70 bg-card p-8 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Your restaurant next
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Fourteen days free. If it doesn't pay for itself, walk away — no contract, no card.
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/signup">Start free trial</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
