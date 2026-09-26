import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Inbox, TrendingUp, Users } from "lucide-react";

import { campaigns, conversations, rand, revenue, revenueTrend, vipsTonight } from "@/lib/mock-data";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/")({
  head: () => dashMeta("Today", "Revenue recovered, tonight's VIPs and what needs your attention."),
  component: Today,
});

function Today() {
  const max = Math.max(...revenueTrend.map((d) => d.revenue));
  const needs = conversations.filter((c) => c.status === "Needs approval" || c.status === "Failed");
  const stats = [
    { label: "Recovered this month", value: rand(revenue.recovered), icon: TrendingUp },
    { label: "Yesterday", value: rand(revenue.yesterday), note: `+${revenue.yesterdayChange}%`, icon: CalendarCheck },
    { label: "Covers this week", value: String(revenue.covers), icon: Users },
    { label: "Open messages", value: String(conversations.filter((c) => c.unread).length), icon: Inbox },
  ];

  return (
    <>
      <PageTitle title="Good evening" sub="Here's what Flavourly did for you today." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="glass-card rounded-2xl border border-border p-4">
            <Icon className="size-4 text-primary" strokeWidth={1.6} />
            <p className="mt-3 font-display text-xl text-foreground sm:text-2xl">{value}</p>
            <p className="text-xs text-muted-foreground">{label} {note && <span className="text-forest">{note}</span>}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass-card rounded-2xl border border-border p-5">
          <h2 className="font-medium text-foreground">This week vs forecast</h2>
          <div className="mt-5 flex h-40 items-end gap-2">
            {revenueTrend.map((d) => (
              <div key={d.day} className="grid flex-1 justify-items-center gap-1.5">
                <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(d.revenue / max) * 140}px` }} title={rand(d.revenue)} />
                <span className="text-[11px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Needs you</h2>
            <Link to="/dashboard/inbox" className="text-sm text-primary">Inbox</Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {needs.map((c) => (
              <li key={c.id} className="rounded-xl bg-card px-3 py-2.5 text-sm">
                <p className="font-medium text-foreground">{c.name} · <span className="text-muted-foreground">{c.intent}</span></p>
                <p className="truncate text-muted-foreground">{c.preview}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-card rounded-2xl border border-border p-5">
          <h2 className="font-medium text-foreground">Tonight's VIPs</h2>
          <ul className="mt-3 divide-y divide-border">
            {vipsTonight.slice(0, 4).map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">{v.name}</p>
                  <p className="text-muted-foreground">{v.time} · {v.party} guests · {v.favourite}</p>
                </div>
                <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs">{v.tier}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Campaigns</h2>
            <Link to="/dashboard/campaigns" className="text-sm text-primary">All</Link>
          </div>
          <ul className="mt-3 grid gap-2">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 text-sm">
                <span className="text-foreground">{c.name}</span>
                <span className="font-medium text-forest">{rand(c.revenue)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
