import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Database,
  Globe2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import {
  approveRevenueActionFn,
  askRevenueEmployeeFn,
  getRevenueEmployeeSnapshot,
  runRevenueEmployeeFn,
  setRevenueEmployeeModeFn,
} from "@/lib/intelligence/functions";
import type { RevenueEmployeeMode, RevenueSnapshot } from "@/lib/intelligence/types";
import { PageTitle, dashMeta } from "./dashboard";

export const Route = createFileRoute("/dashboard/revenue-employee")({
  head: () => dashMeta("Revenue Employee", "Evidence-backed restaurant revenue intelligence and controlled actions."),
  component: RevenueEmployeePage,
});

const money = (cents: number | null) =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 0,
      }).format(cents / 100);

function RevenueEmployeePage() {
  const { profile, ready } = useRestaurantProfile();
  const load = useServerFn(getRevenueEmployeeSnapshot);
  const run = useServerFn(runRevenueEmployeeFn);
  const ask = useServerFn(askRevenueEmployeeFn);
  const setMode = useServerFn(setRevenueEmployeeModeFn);
  const approve = useServerFn(approveRevenueActionFn);

  const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
  const [objective, setObjective] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    if (!ready) return;
    setSnapshot(await load({ data: { tenantId: profile.slug } }));
  }, [load, profile.slug, ready]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const executeRun = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await run({
        data: { tenantId: profile.slug, objective: objective || undefined },
      });
      setMessage(result.ok ? "Evidence pass completed." : result.error);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      setAnswer(await ask({ data: { tenantId: profile.slug, question } }));
    } finally {
      setBusy(false);
    }
  };

  const changeMode = async (mode: RevenueEmployeeMode) => {
    setBusy(true);
    try {
      await setMode({ data: { tenantId: profile.slug, mode } });
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) {
    return <div className="py-20 text-sm text-muted-foreground">Loading Revenue Employee…</div>;
  }

  const pendingActions = snapshot.actions.filter((action) => action.status === "pending_approval");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Revenue Employee"
        sub="Flavourly watches restaurant evidence, explains opportunities and prepares controlled actions."
      />

      <section className="rounded-3xl border border-forest/15 bg-[#173d29] p-5 text-white shadow-[var(--shadow-lift)] sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#d9c675]">
              <Bot className="size-4" /> Revenue Employee
            </div>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl">
              Flavourly is watching {profile.name}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
              Evidence first. Inference stays labelled. Material customer actions remain approval-gated.
            </p>
          </div>

          <div className="min-w-[220px]">
            <label className="text-xs text-white/60">Operating mode</label>
            <select
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
              value={snapshot.mode}
              onChange={(event) => void changeMode(event.target.value as RevenueEmployeeMode)}
              disabled={busy}
            >
              <option value="disabled" className="text-black">Disabled</option>
              <option value="shadow" className="text-black">Shadow</option>
              <option value="approval_only" className="text-black">Approval only</option>
              <option value="active" className="text-black">Active</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat icon={Target} label="Open opportunities" value={String(snapshot.opportunities.length)} />
          <Stat icon={ShieldCheck} label="Approval queue" value={String(pendingActions.length)} />
          <Stat icon={Database} label="Evidence records" value={String(snapshot.evidence.length)} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-card rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Run an evidence pass</h2>
              <p className="text-sm text-muted-foreground">
                Restaurant data first, then configured external evidence providers.
              </p>
            </div>
            <Button onClick={() => void executeRun()} disabled={busy}>
              <RefreshCw className={busy ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
              {busy ? "Working…" : "Run now"}
            </Button>
          </div>
          <Input
            className="mt-4"
            placeholder="Optional objective, e.g. find ways to fill Friday dinner"
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          />
          {message && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
              {message}
            </div>
          )}
          {snapshot.latestRun?.summary && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {snapshot.latestRun.summary}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-5" />
            <div>
              <h2 className="font-display text-xl">Ask the employee</h2>
              <p className="text-sm text-muted-foreground">
                Answers use the evidence already captured for this restaurant.
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            placeholder="How should I improve this week's revenue?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => void askQuestion()}
            disabled={busy || !question.trim()}
          >
            <Sparkles className="mr-2 size-4" /> Ask
          </Button>
          {answer && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Opportunities</p>
            <h2 className="mt-1 font-display text-2xl">What Flavourly found</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {snapshot.latestRun
              ? "Last run " +
                new Date(snapshot.latestRun.finishedAt ?? snapshot.latestRun.startedAt).toLocaleString("en-ZA")
              : "Not run yet"}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {snapshot.opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {opportunity.opportunityType}
                  </p>
                  <h3 className="mt-1 font-display text-xl">{opportunity.title}</h3>
                </div>
                <Badge variant="outline">
                  {opportunity.confidence === null ? "Unknown" : Math.round(opportunity.confidence * 100) + "% confidence"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{opportunity.description}</p>
              {opportunity.estimatedImpactCents !== null && (
                <div className="mt-3 flex items-center gap-2 text-sm text-forest">
                  <TrendingUp className="size-4" /> Estimated impact {money(opportunity.estimatedImpactCents)}
                </div>
              )}
              <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-sm">
                <p className="font-medium">Recommended</p>
                <p className="mt-1 text-muted-foreground">{opportunity.recommendedAction}</p>
              </div>
              {opportunity.evidenceSummary && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <strong>Evidence:</strong> {opportunity.evidenceSummary}
                </p>
              )}
            </article>
          ))}
          {!snapshot.opportunities.length && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              No open opportunities yet. Run the employee to create an evidence-backed starting set.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="glass-card rounded-2xl border border-border p-5">
          <h2 className="font-display text-xl">Needs your approval</h2>
          <div className="mt-4 grid gap-3">
            {pendingActions.map((action) => (
              <div key={action.id} className="rounded-xl border border-border p-4">
                <p className="font-medium">{String(action.payload.campaignName ?? "Revenue action")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {String(action.payload.message ?? "Controlled action ready for review.")}
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const result = await approve({
                        data: {
                          tenantId: profile.slug,
                          actionId: action.id,
                          approvedBy: profile.ownerName || "Restaurant owner",
                        },
                      });
                      setMessage(result.ok ? result.result : result.error);
                      await reload();
                    }}
                  >
                    <CheckCircle2 className="mr-2 size-4" /> Approve & create draft
                  </Button>
                </div>
              </div>
            ))}
            {!pendingActions.length && (
              <p className="text-sm text-muted-foreground">Nothing is waiting for approval.</p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <Globe2 className="size-5" />
            <div>
              <h2 className="font-display text-xl">Capability providers</h2>
              <p className="text-sm text-muted-foreground">
                Adapters stay replaceable; Flavourly keeps the business logic.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {snapshot.providers.map((provider) => (
              <div key={provider.provider} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="text-[11px] text-muted-foreground">{provider.mode}</p>
                </div>
                <span className={provider.configured ? "rounded-full bg-forest-soft px-2 py-1 text-[10px] text-forest" : "rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground"}>
                  {provider.configured ? "configured" : "adapter ready"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white/65">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl text-white">{value}</p>
    </div>
  );
}
