import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Inbox,
  Lightbulb,
  MessageCircle,
  Sparkles,
  TrendingDown,
  Users,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  campaigns,
  conversations,
  rand,
  revenue,
  revenueTrend,
  vipsTonight,
} from "@/lib/mock-data";
import { dashMeta } from "./dashboard";

export const Route = createFileRoute("/dashboard/")({
  head: () =>
    dashMeta(
      "Today",
      "Your restaurant's live operating picture, priority actions and guest signals.",
    ),
  component: Today,
});

const restaurantImage =
  "https://images.pexels.com/photos/8921562/pexels-photo-8921562.jpeg?cs=srgb&dl=pexels-ron-lach-8921562.jpg&fm=jpg";

function Today() {
  const needs = conversations.filter(
    (c) => c.status === "Needs approval" || c.status === "Failed",
  );
  const max = Math.max(...revenueTrend.map((d) => d.revenue));
  const tonightCovers = vipsTonight.reduce((sum, vip) => sum + vip.party, 0);

  return (
    <div className="space-y-6 lg:space-y-8">
      <RestaurantHeader tonightCovers={tonightCovers} />

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Priority board
            </p>
            <h2 className="mt-1 font-display text-2xl text-foreground sm:text-3xl">
              What needs your attention?
            </h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Flavourly is watching the signals between services.
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            tone="urgent"
            icon={MessageCircle}
            eyebrow="Act now"
            title={needs.length ? `${needs.length} guest conversations` : "Inbox is clear"}
            body={
              needs.length
                ? "A response or approval is waiting."
                : "No guest conversations need you."
            }
            action="Open inbox"
            to="/dashboard/inbox"
          />
          <ActionCard
            tone="opportunity"
            icon={TrendingDown}
            eyebrow="Opportunity"
            title="Tuesday is trending quiet"
            body="A slower service window is visible in the demand pattern."
            action="See revenue intelligence"
            to="/dashboard/intelligence/menu-matrix"
          />
          <ActionCard
            tone="vip"
            icon={Wine}
            eyebrow="VIP"
            title={vipsTonight[0] ? `${vipsTonight[0].name} arrives at ${vipsTonight[0].time}` : "No VIPs tonight"}
            body={
              vipsTonight[0]
                ? `${vipsTonight[0].party} guests · ${vipsTonight[0].favourite}`
                : "Flavourly will surface important guests here."
            }
            action="View tonight's guests"
            to="/dashboard"
          />
          <ActionCard
            tone="insight"
            icon={Sparkles}
            eyebrow="Flavourly insight"
            title="There is a better move than another report"
            body="Review the guest and demand signals before service gets busy."
            action="Open AI desk"
            to="/dashboard/replies"
          />
        </div>
      </section>

      <section className="insight-panel relative overflow-hidden rounded-[1.75rem] border border-forest/15 bg-[#173d29] p-5 text-white shadow-[var(--shadow-lift)] sm:p-7">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#5c906e]/25 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#c8a84d]/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d9c675]">
              <Lightbulb className="h-4 w-4" />
              Flavourly insight
            </div>
            <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              Your next commercial move is probably hiding in the guest data.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              You have 145 guests in the current at-risk segment, while tonight includes several
              high-value returning guests. Flavourly brings those signals together so your team can
              act before service gets loud.
            </p>
          </div>

          <Button
            asChild
            className="relative rounded-full bg-white px-5 text-[#173d29] hover:bg-white/90"
          >
            <Link to="/dashboard/replies">
              Review recommendation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <TonightPanel />
        <RevenuePanel max={max} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <GuestPanel />
        <CampaignPanel />
      </section>
    </div>
  );
}

function RestaurantHeader({ tonightCovers }: { tonightCovers: number }) {
  return (
    <section className="restaurant-hero relative overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[var(--shadow-lift)]">
      <img
        src={restaurantImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,30,20,0.88)_0%,rgba(9,30,20,0.68)_47%,rgba(9,30,20,0.24)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,30,20,0.15)_0%,rgba(9,30,20,0.55)_100%)]" />

      <div className="relative min-h-[360px] p-5 sm:min-h-[400px] sm:p-7 lg:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge className="border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/10">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#8fc79f]" />
              Service context
            </Badge>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Thursday · Dinner service
            </p>
            <h1 className="mt-2 max-w-2xl font-display text-4xl leading-tight text-white sm:text-5xl">
              Good evening, Marble.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
              Here is what matters before the floor gets busy.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-right text-white/80 backdrop-blur-md sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Flavourly</p>
            <p className="mt-1 flex items-center justify-end gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-[#8fc79f]" />
              Watching
            </p>
          </div>
        </div>

        <div className="absolute inset-x-5 bottom-5 grid gap-2 sm:inset-x-7 sm:bottom-7 sm:grid-cols-4 lg:inset-x-9 lg:bottom-9">
          <HeroMetric label="Bookings" value="42" detail="Tonight" />
          <HeroMetric label="VIPs" value={String(vipsTonight.length)} detail="Arriving" />
          <HeroMetric label="Covers" value={String(tonightCovers + 10)} detail="Expected" />
          <HeroMetric label="Open messages" value={String(conversations.filter((c) => c.unread).length)} detail="Need attention" />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 backdrop-blur-md">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-white/60">{label}</p>
          <p className="mt-1 font-display text-2xl text-white sm:text-3xl">{value}</p>
        </div>
        <span className="mb-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white/70">
          {detail}
        </span>
      </div>
    </div>
  );
}

function ActionCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  body,
  action,
  to,
}: {
  tone: "urgent" | "opportunity" | "vip" | "insight";
  icon: typeof MessageCircle;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  to: string;
}) {
  const tones = {
    urgent: "bg-[#fff7f4] border-[#f1ddd7]",
    opportunity: "bg-[#fffaf0] border-[#eadfbf]",
    vip: "bg-[#f7f3e7] border-[#e8d7a2]",
    insight: "bg-[#f3f8f4] border-[#d8e8dc]",
  } as const;

  const iconTones = {
    urgent: "text-[#a14d3f] bg-[#a14d3f]/10",
    opportunity: "text-primary bg-primary/10",
    vip: "text-[#8b6b13] bg-[#8b6b13]/10",
    insight: "text-forest bg-forest/10",
  } as const;

  return (
    <article className={`group rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${iconTones[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl leading-tight text-foreground">{title}</h3>
      <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Link
        to={to}
        className="mt-4 inline-flex items-center text-sm font-medium text-foreground transition-colors group-hover:text-primary"
      >
        {action}
        <ChevronRight className="ml-1 h-4 w-4" />
      </Link>
    </article>
  );
}

function TonightPanel() {
  return (
    <section className="glass-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Tonight
          </p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Know the room before it fills.</h2>
        </div>
        <Link to="/dashboard/inbox" className="text-sm text-primary">
          Inbox
        </Link>
      </div>

      <div className="mt-5 grid gap-2.5">
        {vipsTonight.slice(0, 4).map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-3.5 py-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold text-foreground">
                  {v.tier}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {v.time} · {v.party} guests · {v.favourite}
              </p>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">
              <Clock3 className="mr-1 inline h-3.5 w-3.5" />
              Tonight
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RevenuePanel({ max }: { max: number }) {
  return (
    <section className="glass-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Performance
          </p>
          <h2 className="mt-1 font-display text-2xl text-foreground">This week</h2>
        </div>
        <Link to="/dashboard/intelligence/menu-matrix" className="text-sm text-primary">
          Profit
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-secondary p-4">
          <p className="text-xs text-muted-foreground">Yesterday</p>
          <p className="mt-1 font-display text-2xl text-foreground">{rand(revenue.yesterday)}</p>
        </div>
        <div className="rounded-2xl bg-secondary p-4">
          <p className="text-xs text-muted-foreground">Forecast</p>
          <p className="mt-1 font-display text-2xl text-foreground">{rand(revenue.weekForecast)}</p>
        </div>
      </div>

      <div className="mt-6 flex h-28 items-end gap-2">
        {revenueTrend.map((d) => (
          <div key={d.day} className="grid flex-1 justify-items-center gap-1.5">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-primary/50 to-primary/90"
              style={{ height: `${Math.max(12, (d.revenue / max) * 96)}px` }}
              title={`${d.day}: ${rand(d.revenue)}`}
            />
            <span className="text-[10px] text-muted-foreground">{d.day}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GuestPanel() {
  return (
    <section className="glass-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Guest intelligence
          </p>
          <h2 className="mt-1 font-display text-2xl text-foreground">People Flavourly thinks you should know.</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/dashboard/replies">View all</Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {vipsTonight.slice(0, 4).map((v) => (
          <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{v.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v.visits} visits · {rand(v.ltv)} lifetime</p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {v.tier}
              </Badge>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{v.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampaignPanel() {
  const top = campaigns.slice(0, 3);

  return (
    <section className="glass-card rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Campaigns
          </p>
          <h2 className="mt-1 font-display text-2xl text-foreground">What is already in motion.</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/dashboard/campaigns">All</Link>
        </Button>
      </div>

      <div className="mt-5 grid gap-2.5">
        {top.map((campaign) => (
          <div key={campaign.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card">
              <UtensilsCrossed className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{campaign.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {campaign.status} · {campaign.audience} guests
              </p>
            </div>
            <span className="text-xs font-medium text-forest">{rand(campaign.revenue)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
