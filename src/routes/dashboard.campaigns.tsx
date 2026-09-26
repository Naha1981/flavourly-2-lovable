import { createFileRoute } from "@tanstack/react-router";

import { campaigns, rand } from "@/lib/mock-data";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/campaigns")({
  head: () => dashMeta("Campaigns", "WhatsApp campaigns and the bookings and revenue they brought back."),
  component: CampaignsPage,
});

function CampaignsPage() {
  const total = campaigns.reduce((s, c) => s + c.revenue, 0);
  const bookings = campaigns.reduce((s, c) => s + c.bookings, 0);
  return (
    <>
      <PageTitle title="Campaigns" sub={`${rand(total)} brought back from ${bookings} bookings.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const rate = c.sent ? Math.round((c.replies / c.sent) * 100) : 0;
          return (
            <article key={c.id} className="glass-card grid gap-4 rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium text-foreground">{c.name}</h2>
                  <p className="text-xs text-muted-foreground">{c.segment} · {c.audience} guests</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{c.status}</span>
              </div>
              <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground">{c.message}</p>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div><dt className="text-[11px] text-muted-foreground">Reply rate</dt><dd className="font-display text-lg">{rate}%</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Bookings</dt><dd className="font-display text-lg">{c.bookings}</dd></div>
                <div><dt className="text-[11px] text-muted-foreground">Revenue</dt><dd className="font-display text-lg text-forest">{rand(c.revenue)}</dd></div>
              </dl>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${rate}%` }} /></div>
            </article>
          );
        })}
      </div>
    </>
  );
}
