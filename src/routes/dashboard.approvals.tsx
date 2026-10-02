import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listApprovals, resolveApprovalRequest, type ApprovalRequest } from "@/lib/approval.functions";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/approvals")({
  head: () => dashMeta("Approvals", "Review automated WhatsApp messages before they are released."),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { profile, ready } = useRestaurantProfile();
  const list = useServerFn(listApprovals);
  const resolve = useServerFn(resolveApprovalRequest);
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!ready) return;
    try {
      setItems(await list({ data: { tenantId: profile.slug } }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load approvals.");
    }
  }, [ready, profile.slug, list]);

  useEffect(() => { void reload(); }, [reload]);

  const act = async (item: ApprovalRequest, approved: boolean) => {
    setBusy(item.id);
    setError(null);
    try {
      const result = await resolve({
        data: {
          tenantId: profile.slug,
          approvalId: item.id,
          approved,
          resolvedBy: profile.ownerName || "Restaurant manager",
        },
      });
      if (!result.ok) return setError(result.error);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle
        title="Approvals"
        sub={items.length ? `${items.length} automated message${items.length === 1 ? "" : "s"} waiting for a manager.` : "Nothing is waiting for approval."}
      />
      {error && <p className="mb-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      <div className="grid gap-4">
        {items.map((item) => (
          <article key={item.id} className="glass-card grid gap-4 rounded-2xl border border-border p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${item.riskLevel === "red" ? "bg-destructive/10 text-destructive" : "bg-gold-soft text-foreground"}`}>
                <ShieldAlert className="size-3.5" /> {item.riskLevel === "red" ? "High risk" : "Review"}
              </span>
              <span className="text-xs text-muted-foreground">To {item.recipientPhone}</span>
            </div>
            <div className="rounded-xl bg-card p-4 text-sm leading-6 text-foreground whitespace-pre-wrap">{item.messageText}</div>
            <p className="text-sm text-muted-foreground">{item.reason}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void act(item, true)} disabled={busy === item.id}>
                <Check className="size-4" /> Approve & send
              </Button>
              <Button variant="outline" onClick={() => void act(item, false)} disabled={busy === item.id}>
                <X className="size-4" /> Reject
              </Button>
            </div>
          </article>
        ))}
        {!items.length && !error && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Automated promotional, apology and sensitive messages will appear here before they reach guests.
          </div>
        )}
      </div>
    </>
  );
}
