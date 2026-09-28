import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  Crown,
  Inbox,
  MessageCircle,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UtensilsCrossed,
} from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans, rand } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flavourly — Stop revenue leaking out of your restaurant." },
      {
        name: "description",
        content:
          "Flavourly helps South African restaurants find missed demand, answer guests, bring back regulars and turn opportunities into bookings.",
      },
      {
        property: "og:title",
        content: "Flavourly — Stop revenue leaking out of your restaurant.",
      },
      {
        property: "og:description",
        content:
          "Revenue intelligence for restaurants: find missed demand, act on it and keep your team focused on service.",
      },
    ],
  }),
  component: Landing,
});

const engines = [
  {
    icon: BarChart3,
    name: "Revenue Intelligence",
    line: "See quiet trading periods, demand changes and the next revenue opportunity.",
    benefit: "Know where to act before the week slips.",
  },
  {
    icon: Crown,
    name: "VIP Engine",
    line: "Recognise valuable guests, their preferences and when they are returning.",
    benefit: "Make important guests feel remembered.",
  },
  {
    icon: ShieldCheck,
    name: "Reputation Shield",
    line: "Catch reviews and service issues before they quietly become lost customers.",
    benefit: "Protect trust while you run service.",
  },
  {
    icon: Radar,
    name: "Market Radar",
    line: "Watch local menu, offer and demand signals for changes worth acting on.",
    benefit: "See opportunities your competitors miss.",
  },
  {
    icon: Send,
    name: "Marketing Autopilot",
    line: "Find dormant guests, draft relevant offers and put approved campaigns into motion.",
    benefit: "Turn existing customers back into revenue.",
  },
  {
    icon: Inbox,
    name: "Unified Inbox",
    line: "Keep customer conversations, intent and AI drafts in one operational view.",
    benefit: "Stop high-intent messages disappearing after hours.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <RevenueLeakSection />
        <RevenueFlow />
        <MagicLink />
        <Engines />
        <Story />
        <PricingPeek />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-field relative overflow-hidden border-b border-border/70">
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <div className="hero-signal hero-signal-one" aria-hidden="true" />
      <div className="hero-signal hero-signal-two" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-card/75 px-3 py-1.5 text-xs font-medium text-forest shadow-sm backdrop-blur">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-forest" />
            Revenue intelligence for restaurants
          </div>

          <h1 className="hero-title mt-6 max-w-3xl text-balance-tight font-display text-5xl leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
            Your restaurant is losing revenue
            <span className="block text-primary">while you're busy running it.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Flavourly watches customer demand, missed messages, quiet trading periods and returning
            guests — then helps your team turn those opportunities into bookings and repeat
            business.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full px-7 text-base shadow-[var(--shadow-lift)]"
            >
              <Link to="/claim/$slug" params={{ slug: "marble-jhb" }}>
                See what Flavourly finds <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-border bg-card/80 px-7 text-base backdrop-blur"
            >
              <Link to="/signup">Start free trial</Link>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {[
              "Works with your existing WhatsApp",
              "Designed for busy restaurant teams",
              "South African pricing in ZAR",
            ].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-forest" />
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 border-t border-border/60 pt-5 text-sm text-muted-foreground">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-forest/10">
              <Sparkles className="h-4 w-4 text-forest" />
            </div>
            <p>
              <span className="font-medium text-foreground">Not another dashboard.</span> Flavourly
              is built to spot the next commercial move.
            </p>
          </div>
        </div>

        <HeroExperience />
      </div>
    </section>
  );
}

function HeroExperience() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem]">
      <div className="hero-orbit absolute -inset-8 rounded-[3rem]" aria-hidden="true" />
      <div className="relative rounded-[2rem] border border-foreground/10 bg-card/80 p-3 shadow-[var(--shadow-lift)] backdrop-blur-xl">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-forest/10">
                <MessageCircle className="h-5 w-5 text-forest" />
              </div>
              <div>
                <p className="text-sm font-semibold">Flavourly operator</p>
                <p className="text-xs text-forest">Watching demand</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-forest/20 bg-forest/5 text-forest"
            >
              Live demo
            </Badge>
          </div>

          <div className="mt-5 space-y-3">
            <Bubble side="left" time="23:41" delay={500}>
              Table for 2 tonight?
            </Bubble>
            <Bubble side="right" time="23:41" delay={1500}>
              I found a window table at 19:00. Shall I book it?
            </Bubble>
            <Bubble side="left" time="23:42" delay={2600}>
              Yes please 🙏
            </Bubble>
            <Bubble side="right" time="23:42" delay={3600}>
              Booked. I'll keep the table warm for Kabelo.
            </Bubble>
          </div>

          <div
            className="stage-in mt-5 rounded-[1.4rem] border border-forest/15 bg-forest/5 p-4"
            style={{ "--stage-delay": "4600ms" } as React.CSSProperties}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">
                Signal detected
              </p>
              <ArrowDownRight className="h-4 w-4 text-forest" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <SignalChip label="Intent" value="Booking" />
              <SignalChip label="Action" value="Reserve" />
              <SignalChip label="Outcome" value="Cover" />
            </div>
          </div>
        </div>
      </div>

      <div className="hero-float glass-card absolute -bottom-5 -left-4 hidden w-56 rounded-2xl p-4 sm:block">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Tonight
        </p>
        <p className="mt-1 font-display text-2xl text-foreground">VIP arriving</p>
        <p className="mt-1 text-sm text-muted-foreground">Thabo · 19:00 · 4 guests</p>
      </div>

      <div className="hero-float hero-float-delay glass-card absolute -right-4 -top-5 hidden w-52 rounded-2xl p-4 sm:block">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Tuesday
        </p>
        <p className="mt-1 font-display text-2xl text-foreground">Demand watch</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-primary">
          <ArrowDownRight className="h-3.5 w-3.5" />
          Quiet period detected
        </p>
      </div>
    </div>
  );
}

function SignalChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Bubble({
  side,
  time,
  delay = 0,
  children,
}: {
  side: "left" | "right";
  time: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const isRight = side === "right";
  return (
    <div
      className={`stage-in ${isRight ? "flex justify-end" : "flex justify-start"}`}
      style={{ "--stage-delay": `${delay}ms` } as React.CSSProperties}
    >
      <div
        className={
          isRight
            ? "max-w-[88%] rounded-2xl rounded-br-md bg-forest/10 px-3.5 py-2.5 text-foreground"
            : "max-w-[88%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-foreground"
        }
      >
        <p className="text-sm leading-snug">{children}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function RevenueLeakSection() {
  const leaks = [
    {
      time: "23:47",
      title: "A high-intent message arrives.",
      body: "Nobody replies because the team is asleep.",
      icon: MessageCircle,
    },
    {
      time: "10:03",
      title: "Tuesday is going quiet.",
      body: "The owner sees the problem after the damage is done.",
      icon: BarChart3,
    },
    {
      time: "18:15",
      title: "A valuable regular walks in.",
      body: "The guest is treated like a first-timer.",
      icon: Crown,
    },
    {
      time: "23:12",
      title: "A bad experience becomes a review.",
      body: "The response waits until the next morning.",
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="border-b border-border/70 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              The revenue leaks
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              The leaks are usually invisible.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Restaurant owners rarely lose revenue because they don't care. They lose it because
              demand arrives at the wrong time, in the wrong channel, or while everyone is busy.
            </p>
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                <span className="font-semibold">Flavourly connects the signals.</span> It turns
                fragmented guest activity into one operational picture.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {leaks.map((leak, index) => (
              <Reveal key={leak.time} delay={index * 120} className="h-full">
                <article className="glass-card group h-full rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                      {leak.time}
                    </span>
                    <leak.icon className="h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <h3 className="mt-5 font-display text-xl leading-tight">{leak.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{leak.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RevenueFlow() {
  const steps = [
    {
      key: "01",
      label: "Demand",
      body: "Guest messages, booking intent, quiet periods",
      icon: MessageCircle,
    },
    {
      key: "02",
      label: "Intelligence",
      body: "Flavourly connects the signal to context",
      icon: Sparkles,
    },
    { key: "03", label: "Action", body: "Reply, recover, target or escalate", icon: Send },
    {
      key: "04",
      label: "Outcome",
      body: "More bookings, repeat visits and clarity",
      icon: UtensilsCrossed,
    },
  ];

  return (
    <section className="overflow-hidden border-b border-border/70 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            The Flavourly loop
          </p>
          <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            From missed signal to booked table.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Flavourly is designed around the commercial loop — not another collection of
            disconnected AI features.
          </p>
        </div>

        <div className="relative mt-12 grid gap-4 md:grid-cols-4">
          <div className="flow-line" aria-hidden="true" />
          {steps.map((step, index) => (
            <Reveal key={step.key} delay={index * 160} className="relative z-10">
              <article className="relative h-full rounded-3xl border border-border/80 bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-lg text-primary">{step.key}</span>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
                    <step.icon className="h-4 w-4 text-foreground" />
                  </div>
                </div>
                <h3 className="mt-6 font-display text-2xl">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                {index < steps.length - 1 ? (
                  <ArrowRight className="flow-arrow absolute -right-3 top-1/2 z-20 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-background p-0.5 text-primary md:block" />
                ) : null}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MagicLink() {
  return (
    <section className="magic-link-surface border-b border-border/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            The Magic Link
          </p>
          <h2 className="mt-3 max-w-xl font-display text-4xl leading-tight sm:text-5xl">
            Don't imagine Flavourly. See your restaurant inside it.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            Give a prospect a branded workspace built around their restaurant — menu, identity,
            guests and opportunities — before asking them to sit through a sales demo.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/claim/$slug" params={{ slug: "marble-jhb" }}>
                Open a live restaurant demo <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link to="/product">See how it works</Link>
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="magic-window rounded-[2rem] border border-foreground/10 bg-card/85 p-3 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            <div className="rounded-[1.5rem] bg-background p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border/70 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Your restaurant
                  </p>
                  <p className="mt-1 font-display text-2xl">Marble · Rosebank</p>
                </div>
                <Badge className="rounded-full bg-forest/10 text-forest hover:bg-forest/10">
                  Preview
                </Badge>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="mt-1 text-sm font-semibold">Matched</p>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Menu</p>
                  <p className="mt-1 text-sm font-semibold">Loaded</p>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Guests</p>
                  <p className="mt-1 text-sm font-semibold">Ready</p>
                </div>
                <div className="rounded-2xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">Opportunities</p>
                  <p className="mt-1 text-sm font-semibold">3 found</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  First look
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  “Your restaurant is ready to explore. See the same signals your team would see —
                  using your own brand.”
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -right-2 hidden rounded-2xl border border-forest/15 bg-card px-4 py-3 text-sm shadow-[var(--shadow-soft)] sm:block">
            <p className="text-xs text-muted-foreground">Prospect experience</p>
            <p className="mt-1 font-semibold text-forest">Own restaurant. Before sign-up.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Engines() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          One system. Six revenue engines.
        </p>
        <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Every part of Flavourly answers one question: what should we do next?
        </h2>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {engines.map((engine, index) => (
          <Reveal key={engine.name} delay={(index % 3) * 120} className="h-full">
            <article className="engine-card group relative h-full overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
              <div className="engine-number" aria-hidden="true">
                0{index + 1}
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary">
                <engine.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              </div>
              <h3 className="mt-5 font-display text-2xl">{engine.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{engine.line}</p>
              <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-sm font-medium text-forest">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {engine.benefit}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Story() {
  return (
    <section className="story-surface border-y border-border/70">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              A Tuesday, inside Flavourly
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              See the system move from signal to action.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              This is an illustrative product workflow, not a customer revenue claim.
            </p>

            <div className="mt-8 space-y-4">
              {[
                ["10:00", "Demand watch", "Tuesday is trending quiet."],
                ["10:07", "Opportunity", "145 dormant guests are eligible for a win-back."],
                ["10:12", "Campaign", "Flavourly drafts the offer and target audience."],
                ["10:16", "Approval", "Owner approves between prep and service."],
              ].map(([time, title, body], i) => (
                <Reveal key={time} delay={i * 180}>
                  <div className="flex gap-4">
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                      {time}
                    </span>
                    <div className="relative border-l border-border/80 pl-5 pb-1">
                      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_var(--background)]" />
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground">Campaign · Tuesday Rescue</p>
              <Badge className="rounded-full bg-forest/10 text-forest hover:bg-forest/10">
                Illustrative
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { k: "Audience", v: "145" },
                { k: "Replies", v: "—" },
                { k: "Bookings", v: "—" },
                { k: "Revenue", v: "—" },
              ].map((m) => (
                <div key={m.k} className="rounded-2xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">{m.k}</p>
                  <p className="mt-1 font-display text-2xl">{m.v}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Example message
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                “Howzit Lerato! We miss you. Reply BOOK if you'd like to join us this Tuesday.”
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" />
                Built around approval, attribution and evidence.
              </div>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingPeek() {
  const preview = plans.slice(0, 3);
  return (
    <section className="border-t border-border/70 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              One useful intervention should justify the subscription.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Start with the level of automation your restaurant needs. Upgrade as more revenue
              workflows move into Flavourly.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/pricing">Compare all five tiers</Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {preview.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.popular
                  ? "rounded-3xl border-2 border-primary bg-background p-6 shadow-[var(--shadow-lift)]"
                  : "rounded-3xl border border-border bg-background p-6"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl">{plan.name}</h3>
                {plan.popular ? <Badge className="rounded-full">Most popular</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.target}</p>
              <p className="mt-5 font-display text-3xl">
                {rand(plan.price)}
                <span className="font-sans text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-5 grid gap-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full rounded-full"
                variant={plan.popular ? "default" : "outline"}
              >
                <Link to="/signup" search={{ plan: plan.name.toLowerCase() }}>
                  Start free trial
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="surface-grain">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Your next shift starts here
        </p>
        <h2 className="mt-3 font-display text-4xl leading-tight sm:text-6xl">
          Let Flavourly watch the leaks while you run service.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          See your restaurant inside Flavourly, understand the opportunity and decide what to
          automate next.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-full px-8 text-base">
            <Link to="/claim/$slug" params={{ slug: "marble-jhb" }}>
              See the restaurant demo <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full bg-card px-8 text-base"
          >
            <Link to="/contact">Talk to us</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
