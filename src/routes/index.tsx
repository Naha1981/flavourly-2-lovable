import { createFileRoute, Link } from "@tanstack/react-router";
import {
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
} from "lucide-react";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans, rand } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flavourly — Your restaurant, fully booked. While you cook." },
      {
        name: "description",
        content:
          "Flavourly answers WhatsApp in seconds, spots your VIPs, defends your rating and fills quiet nights. Built for South African restaurants.",
      },
      { property: "og:title", content: "Flavourly — Your restaurant, fully booked." },
      {
        property: "og:description",
        content:
          "The AI revenue employee for South African restaurants. Bookings, reputation and marketing, handled while you cook.",
      },
    ],
  }),
  component: Landing,
});

const engines = [
  {
    icon: BarChart3,
    name: "Revenue Intelligence",
    line: "Yesterday's verified revenue, today's forecast, and the one move that fixes a slow week.",
    proof: "Bank-verified money, not vanity bookings.",
  },
  {
    icon: Crown,
    name: "VIP Engine",
    line: "Knows who's walking in tonight, what they drink, and what they're worth.",
    proof: "VIPs spend 3.5× more. You'll never miss one again.",
  },
  {
    icon: ShieldCheck,
    name: "Reputation Shield",
    line: "A 1-star lands at 23:00. The apology is drafted before you wake up.",
    proof: "12 at-risk guests recovered last month.",
  },
  {
    icon: Radar,
    name: "Market Radar",
    line: "Watches every competitor menu and price within 5 km, weekly.",
    proof: "Sunday brunch gap → R8,000 first weekend.",
  },
  {
    icon: Send,
    name: "Marketing Autopilot",
    line: "Finds dormant regulars, writes the offer, sends it on WhatsApp.",
    proof: "R3,200 recovered from R0 ad spend.",
  },
  {
    icon: Inbox,
    name: "Unified Inbox",
    line: "WhatsApp, Instagram, Facebook and email in one stream with AI drafts.",
    proof: "0 missed messages. 100% response rate.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ProofBar />
        <Engines />
        <MagicLink />
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
    <section className="surface-grain relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div>
          <Badge
            variant="outline"
            className="rounded-full border-primary/25 bg-card px-3 py-1 text-xs font-medium text-primary"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Built for South African restaurants
          </Badge>

          <h1 className="mt-5 text-balance-tight font-display text-4xl leading-[1.05] text-foreground sm:text-5xl lg:text-6xl">
            Your restaurant,
            <br />
            fully booked.
            <span className="block text-primary">While you cook.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Flavourly isn't another dashboard. It's an AI revenue employee that answers WhatsApp at
            2am, remembers every VIP's wine, and quietly fills your Tuesdays — while you're on the
            pass.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7 text-base">
              <Link to="/signup">
                Start 14-day free trial <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-border bg-card px-7 text-base"
            >
              <Link to="/claim/$slug" params={{ slug: "marble-jhb" }}>
                See it with your branding
              </Link>
            </Button>
          </div>

          <ul className="mt-7 grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Live in under 5 minutes",
              "No card required",
              "Works on your existing WhatsApp",
              "Cancel any time",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-forest" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <PhoneMock />
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="glass-card rounded-[2.25rem] p-3 shadow-[var(--shadow-lift)]">
        <div className="rounded-[1.75rem] bg-card p-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest/10">
              <MessageCircle className="h-5 w-5 text-forest" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Marble · WhatsApp</p>
              <p className="text-xs text-forest">AI host online</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <Bubble side="left" time="23:41">
              Table for 2 tonight?
            </Bubble>
            <Bubble side="right" time="23:41">
              Howzit! I have a lovely table by the window at 19:00. Shall I book it?
            </Bubble>
            <Bubble side="left" time="23:42">
              Yes please 🙏
            </Bubble>
            <Bubble side="right" time="23:42">
              Booked — 19:00 for two under Kabelo. We'll have the Pinotage ready.
            </Bubble>
          </div>

          <div className="mt-5 rounded-2xl bg-secondary p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Booked while you slept
            </p>
            <p className="mt-1 font-display text-2xl text-forest">{rand(4800)}</p>
            <p className="text-xs text-muted-foreground">12 covers · 0 missed messages</p>
          </div>
        </div>
      </div>

      <div className="glass-card absolute -bottom-6 -left-2 hidden w-56 rounded-2xl p-4 sm:block">
        <p className="text-xs font-medium text-muted-foreground">VIP arriving 19:00</p>
        <p className="mt-1 text-sm font-semibold">Thabo Mokoena</p>
        <p className="text-xs text-forest">{rand(45200)} lifetime value</p>
      </div>
    </div>
  );
}

function Bubble({
  side,
  time,
  children,
}: {
  side: "left" | "right";
  time: string;
  children: React.ReactNode;
}) {
  const isRight = side === "right";
  return (
    <div className={isRight ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isRight
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-forest/10 px-3.5 py-2.5 text-foreground"
            : "max-w-[85%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-foreground"
        }
      >
        <p className="leading-snug">{children}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function ProofBar() {
  const stats = [
    { value: "R2.4m", label: "Revenue recovered for restaurants" },
    { value: "4 min", label: "Median reply time, day or night" },
    { value: "100%", label: "Messages answered" },
    { value: "< 5 min", label: "From sign-up to first booking" },
  ];
  return (
    <section className="border-y border-border/70 bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="font-display text-3xl text-foreground">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Engines() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Six engines of revenue
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
          Every screen answers one question: how does this make me money?
        </h2>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {engines.map((engine) => (
          <article
            key={engine.name}
            className="glass-card group rounded-2xl p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary">
              <engine.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <h3 className="mt-4 font-display text-xl">{engine.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{engine.line}</p>
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm font-medium text-forest">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {engine.proof}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MagicLink() {
  return (
    <section className="border-y border-border/70 bg-secondary/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            The Magic Link
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            Don't take a demo. Open your own restaurant, already inside Flavourly.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Before you speak to anyone, our Brand Intelligence Engine reads your website — logo,
            colours, menu, Google reviews — and builds your app. You open a link and see your
            place, your dishes, your guests. Then you claim it.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link to="/claim/$slug" params={{ slug: "marble-jhb" }}>
                Open a live Magic Link
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link to="/product">How it works</Link>
            </Button>
          </div>
        </div>

        <ol className="grid gap-3">
          {[
            { step: "01", title: "We read your website", body: "Logo, palette, menu, reviews." },
            { step: "02", title: "We build your app", body: "A working tenant, branded as you." },
            { step: "03", title: "You open the link", body: "On your phone, in about six seconds." },
            { step: "04", title: "You claim it", body: "One tap flips demo into a live trial." },
          ].map((item) => (
            <li key={item.step} className="glass-card flex gap-4 rounded-2xl p-5">
              <span className="font-display text-lg text-primary">{item.step}</span>
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            The Tuesday slump
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            10:00. Empty dining room. By 11:30 you're at twelve tables.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Flavourly saw Tuesday trending 15% down, wrote a steak special, picked the 150 regulars
            who hadn't visited in 30 days, and sent it on WhatsApp. You approved it between prep and
            service.
          </p>
          <blockquote className="mt-7 border-l-2 border-primary pl-5 font-display text-xl leading-relaxed text-foreground">
            "The app paid for its own monthly subscription in one hour."
            <footer className="mt-2 font-sans text-sm font-normal text-muted-foreground">
              Warren N. — owner, two-site grill, Johannesburg
            </footer>
          </blockquote>
        </div>

        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-muted-foreground">Campaign · Tuesday Steak</p>
            <Badge className="rounded-full bg-forest/10 text-forest hover:bg-forest/10">Live</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "Sent", v: "150" },
              { k: "Replies", v: "41" },
              { k: "Bookings", v: "12" },
              { k: "Revenue", v: rand(4800) },
            ].map((m) => (
              <div key={m.k} className="rounded-2xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground">{m.k}</p>
                <p className="mt-1 font-display text-xl">{m.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-border p-4 text-sm leading-relaxed text-muted-foreground">
            "Howzit Lerato! We miss you. 15% off your favourite rib-eye this Tuesday. Reply 'BOOK'
            to claim."
          </div>
          <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-primary text-primary" />
            ))}
            <span className="ml-2">4.7 average across 3,128 reviews</span>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              One booked table a week covers it.
            </h2>
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
                {plan.popular ? (
                  <Badge className="rounded-full">Most popular</Badge>
                ) : null}
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
        <h2 className="font-display text-3xl leading-tight sm:text-5xl">
          Tonight's messages will be answered.
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Set it up between lunch and dinner service. Your first AI booking usually lands the same
          evening.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-full px-8 text-base">
            <Link to="/signup">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full bg-card px-8 text-base">
            <Link to="/contact">Talk to us</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
