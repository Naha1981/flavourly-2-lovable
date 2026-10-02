import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Plus, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { addCompetitor, listMarket, resolveOpportunity, type CompetitorRecord, type MarketOpportunity } from "@/lib/market.functions";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/market")({
  head: () => dashMeta("Market", "Competitors, positioning evidence and market opportunities."),
  component: MarketPage,
});

function MarketPage() {
  const { profile, ready } = useRestaurantProfile();
  const list = useServerFn(listMarket);
  const add = useServerFn(addCompetitor);
  const resolve = useServerFn(resolveOpportunity);
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!ready) return;
    const data = await list({ data: { tenantId: profile.slug } });
    setCompetitors(data.competitors);
    setOpportunities(data.opportunities);
  }, [list, profile.slug, ready]);

  useEffect(() => { void reload(); }, [reload]);

  const saveCompetitor = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await add({ data: { tenantId: profile.slug, name, address: address || null, websiteUrl: null } });
      setName("");
      setAddress("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Market intelligence" sub="Track named competitors and turn external evidence into specific opportunities." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-foreground">Competitors</h2>
              <p className="text-sm text-muted-foreground">Start with the restaurants your team actually watches.</p>
            </div>
            <MapPin className="size-5 text-muted-foreground" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Input placeholder="Competitor name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Area / address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Button className="sm:col-span-2" onClick={() => void saveCompetitor()} disabled={busy}>
              <Plus className="size-4" /> Add competitor
            </Button>
          </div>
          <div className="mt-5 grid gap-2">
            {competitors.map((competitor) => (
              <div key={competitor.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{competitor.name}</p>
                  {competitor.rating !== null && <span className="text-sm text-muted-foreground">{competitor.rating.toFixed(1)} · {competitor.reviewCount} reviews</span>}
                </div>
                {competitor.address && <p className="mt-1 text-xs text-muted-foreground">{competitor.address}</p>}
              </div>
            ))}
            {!competitors.length && <p className="text-sm text-muted-foreground">No competitors tracked yet.</p>}
          </div>
        </section>

        <section className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <Target className="size-5 text-muted-foreground" />
            <div>
              <h2 className="font-display text-xl text-foreground">Open opportunities</h2>
              <p className="text-sm text-muted-foreground">Evidence-backed gaps ready for a decision.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {opportunities.map((opportunity) => (
              <article key={opportunity.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">{opportunity.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{opportunity.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gold-soft px-2 py-1 text-[11px]">{opportunity.opportunityType}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{opportunity.confidence === null ? "Confidence not scored" : Math.round(opportunity.confidence * 100) + "% confidence"}</span>
                  <Button size="sm" variant="outline" onClick={async () => { await resolve({ data: { tenantId: profile.slug, opportunityId: opportunity.id } }); await reload(); }}>
                    Mark addressed
                  </Button>
                </div>
              </article>
            ))}
            {!opportunities.length && <p className="text-sm text-muted-foreground">No open opportunities yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
