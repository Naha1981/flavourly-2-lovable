import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReplyUsage, type ReplyUsage } from "@/lib/whatsapp-usage.functions";
import { Button } from "@/components/ui/button";
export function WhatsAppUsage({ tenantId }: { tenantId: string }) {
  const load = useServerFn(getReplyUsage);
  const [usage, setUsage] = useState<ReplyUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setUsage(await load({ data: { tenantId } }));
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const reference = /Reference: (PGRST[0-9]{3}|[0-9A-Z]{5}|RPC_ERROR|EMPTY_RESULT)$/.exec(
        message,
      )?.[1];
      setError(reference ?? "UNAVAILABLE");
    }
  }, [load, tenantId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <section
      className="mb-6 rounded-2xl border border-border bg-card p-5"
      aria-label="WhatsApp reply allowance"
    >
      <h2 className="font-display text-xl">WhatsApp reply allowance</h2>
      {error ? (
        <p className="mt-2 text-sm">
          Usage unavailable. Sending must stay paused until checked. Reference: {error}.
        </p>
      ) : !usage ? (
        <p className="mt-2 text-sm">Checking usage...</p>
      ) : (
        <>
          <p className="mt-3">
            This month: {usage.monthlyUsed ?? 0} / {usage.monthlyLimit ?? 0} replies
          </p>
          <p>
            Today: {usage.dailyUsed ?? 0} / {usage.dailyLimit ?? 25} replies (pilot limit)
          </p>
          {usage.trialLimit != null && (
            <p>
              Trial: {usage.trialUsed ?? 0} / {usage.trialLimit} replies, also counted in the
              monthly allowance
            </p>
          )}
          <p className="mt-2 text-sm">
            {usage.allowed
              ? "Allowance available. Connection and sending still require activation approval."
              : "Automatic replies stopped. A team member must take over."}
          </p>
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        South African calendar month and day. Reserved attempts count even if delivery fails. One
        number per venue; no paid overage or automatic retry.
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
        Refresh usage
      </Button>
    </section>
  );
}
