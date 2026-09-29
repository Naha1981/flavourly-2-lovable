import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listIncidents,
  sendRecovery,
  updateIncident,
  type Incident,
} from "@/lib/reputation.functions";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/reputation")({
  head: () =>
    dashMeta(
      "Reputation",
      "Private feedback from guests who had a poor evening, so you can fix it before it becomes a review.",
    ),
  component: ReputationPage,
});

const STATUS_LABEL: Record<Incident["status"], string> = {
  open: "Open",
  investigating: "Investigating",
  voucher_sent: "Voucher sent",
  resolved: "Resolved",
  ignored: "Ignored",
};
const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function ReputationPage() {
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;
  const list = useServerFn(listIncidents);
  const update = useServerFn(updateIncident);
  const recover = useServerFn(sendRecovery);
  const [items, setItems] = useState<Incident[] | null>(null);
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(
    async () => setItems(await list({ data: { tenantId } })),
    [list, tenantId],
  );
  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  if (!ready || !items) return null;
  const openCount = items.filter((i) => i.status === "open" || i.status === "investigating").length;

  const send = async (i: Incident) => {
    const rands = Number((amount[i.id] ?? "150").replace(",", "."));
    if (!Number.isFinite(rands) || rands < 10) return setMsg("Enter an amount of at least R10.");
    if (
      !confirm(
        `Send an apology and ${formatZAR(Math.round(rands * 100))} voucher to ${i.customerName ?? i.customerPhone}?`,
      )
    )
      return;
    setBusy(i.id);
    setMsg(null);
    try {
      const r = await recover({
        data: { tenantId, incidentId: i.id, amountCents: Math.round(rands * 100) },
      });
      setMsg(r.ok ? `Sent. Voucher code ${r.code}.` : r.error);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle
        title="Reputation"
        sub="Guests who rate 1–3 stars come here privately. Only 4–5 star guests are sent to Google."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        {openCount === 0
          ? "Nothing needs attention."
          : `${openCount} need${openCount === 1 ? "s" : ""} attention.`}
      </p>
      {msg && (
        <p role="status" className="mb-4 text-sm text-foreground">
          {msg}
        </p>
      )}

      <div className="grid gap-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No incidents yet. Feedback requests go out about two hours after a booking, once
            auto-replies are on.
          </p>
        )}
        {items.map((i) => (
          <article
            key={i.id}
            className="glass-card grid gap-3 rounded-2xl border border-border p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {i.customerName ?? "Guest"}{" "}
                  <span className="font-normal text-muted-foreground">· +{i.customerPhone}</span>
                </p>
                <p
                  className="flex items-center gap-0.5 text-primary"
                  aria-label={`${i.rating} out of 5 stars`}
                >
                  {Array.from({ length: 5 }, (_, n) => (
                    <Star
                      key={n}
                      className={`size-4 ${n < i.rating ? "fill-primary" : "text-border"}`}
                    />
                  ))}
                </p>
              </div>
              <time dateTime={i.createdAt} className="text-xs text-muted-foreground">
                {new Date(i.createdAt).toLocaleString("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="text-sm text-foreground">
              {i.feedbackText ?? (
                <span className="text-muted-foreground">
                  Waiting for the guest to say what went wrong.
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Status"
                className={selectCls}
                value={i.status}
                onChange={async (e) => {
                  await update({
                    data: {
                      tenantId,
                      incidentId: i.id,
                      status: e.target.value as Incident["status"],
                    },
                  });
                  await reload();
                }}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Assigned to"
                className="h-9 w-40"
                placeholder="Assign to…"
                defaultValue={i.assignedTo ?? ""}
                onBlur={async (e) => {
                  if ((e.target.value || null) !== i.assignedTo) {
                    await update({
                      data: { tenantId, incidentId: i.id, assignedTo: e.target.value || null },
                    });
                    await reload();
                  }
                }}
              />
              {i.voucherCode ? (
                <span className="text-sm text-forest">
                  Voucher {i.voucherCode} · {formatZAR(i.voucherCents ?? 0)} ·{" "}
                  {i.voucherUsedAt ? "used" : "not used yet"}
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm text-muted-foreground">
                    R
                    <Input
                      aria-label="Voucher amount in rand"
                      inputMode="decimal"
                      className="h-9 w-20"
                      value={amount[i.id] ?? "150"}
                      onChange={(e) => setAmount({ ...amount, [i.id]: e.target.value })}
                    />
                  </label>
                  <Button size="sm" disabled={busy === i.id} onClick={() => send(i)}>
                    {busy === i.id ? "Sending…" : "Send apology + voucher"}
                  </Button>
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
