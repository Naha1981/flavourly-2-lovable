import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { getMenuMatrix, setItemAvailability } from "@/lib/menu.functions";
import type { MatrixClass, MatrixSummary } from "@/lib/menu-matrix";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/intelligence/menu-matrix")({
  head: () =>
    dashMeta("Menu profit", "See which dishes make you money and which quietly cost you."),
  component: MenuMatrixPage,
});

const LABELS: Record<MatrixClass, { title: string; hint: string; tone: string }> = {
  STAR: {
    title: "Stars",
    hint: "Popular and profitable",
    tone: "border-forest/40 bg-forest-soft/40",
  },
  PLOWHORSE: { title: "Plowhorses", hint: "Popular, thin margin", tone: "border-primary/40" },
  PUZZLE: { title: "Puzzles", hint: "Profitable, overlooked", tone: "border-border" },
  DOG: { title: "Dogs", hint: "Slow and thin", tone: "border-destructive/30" },
};
const ORDER: MatrixClass[] = ["STAR", "PLOWHORSE", "PUZZLE", "DOG"];

function MenuMatrixPage() {
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;
  const load = useServerFn(getMenuMatrix);
  const setAvail = useServerFn(setItemAvailability);
  const [summary, setSummary] = useState<MatrixSummary | null>(null);
  const [filter, setFilter] = useState<MatrixClass | "ALL">("ALL");

  const reload = useCallback(
    async () => setSummary(await load({ data: { tenantId } })),
    [load, tenantId],
  );
  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  if (!ready || !summary) return null;
  const items = summary.items
    .filter((i) => filter === "ALL" || i.cls === filter)
    .sort((a, b) => b.profitCents30d - a.profitCents30d);

  return (
    <>
      <PageTitle
        title="Menu profit"
        sub="Volume and margin per dish over the last 30 days, compared with your own menu average."
      />
      {summary.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add dishes with prices, costs and 30-day sales on the Menu page to see this.
        </p>
      ) : (
        <>
          {summary.missingCostCount > 0 && (
            <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-foreground">
              {summary.missingCostCount} dish{summary.missingCostCount === 1 ? " has" : "es have"}{" "}
              no cost recorded, so a 35% food cost is assumed. Add real costs for accurate results.
            </p>
          )}
          <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["30-day menu revenue", formatZAR(summary.revenueCents30d)],
              ["Gross profit", formatZAR(summary.profitCents30d)],
              ["Average sales per dish", `${summary.avgVolume}`],
              ["Average profit per dish", formatZAR(summary.avgMarginCents)],
            ].map(([k, v]) => (
              <div key={k} className="glass-card rounded-2xl border border-border p-4">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-display text-xl text-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by group">
            {(["ALL", ...ORDER] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1.5 text-sm ${filter === k ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
              >
                {k === "ALL"
                  ? `All (${summary.items.length})`
                  : `${LABELS[k].title} (${summary.counts[k]})`}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <article
                key={i.id}
                className={`glass-card grid gap-3 rounded-2xl border p-4 ${LABELS[i.cls].tone}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {LABELS[i.cls].title}
                    </p>
                    <h2 className="font-medium text-foreground">{i.name}</h2>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-foreground">{formatZAR(i.priceCents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.marginPct}% margin{i.costKnown ? "" : " (est.)"}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Sold (30 days)</dt>
                    <dd>{i.salesCount30d}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Profit each</dt>
                    <dd>{formatZAR(i.marginCents)}</dd>
                  </div>
                </dl>
                <p className="text-sm text-muted-foreground">{i.action}</p>
                {i.cls === "DOG" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await setAvail({
                        data: { tenantId, itemId: i.id, isAvailable: !i.isAvailable },
                      });
                      await reload();
                    }}
                  >
                    {i.isAvailable ? "Mark sold out" : "Put back on the menu"}
                  </Button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
