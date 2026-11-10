import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActivationReadiness } from "@/lib/activation-readiness.functions";
import { Button } from "@/components/ui/button";
export function ActivationReadiness({ tenantId }: { tenantId: string }) {
  const load = useServerFn(getActivationReadiness);
  const [data, setData] = useState<Awaited<ReturnType<typeof getActivationReadiness>> | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setData(await load({ data: { tenantId } }));
      setError(false);
    } catch {
      setError(true);
    }
  }, [load, tenantId]);
  useEffect(() => {
    if (tenantId) void refresh();
  }, [refresh, tenantId]);
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Activation checks</h2>
      {error ? (
        <p role="alert" className="mt-3">
          Activation status could not load. Manager access is required. Nothing was enabled.
        </p>
      ) : !data ? (
        <p role="status" className="mt-3">
          Checking activation status...
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-2 text-sm">
            <li>
              Connection switch: {data.connectEnabled ? "enabled" : "paused"}. Sending switch:{" "}
              {data.sendEnabled ? "enabled" : "paused"}. Reply switch:{" "}
              {data.aiEnabled ? "enabled" : "paused"}.
            </li>
            <li>
              Provider setup:{" "}
              {data.providerConfigured
                ? "key present, account capacity still needs verification"
                : "not configured"}
              . Reply setup:{" "}
              {data.aiConfigured
                ? "key present, free capacity still needs verification"
                : "not configured"}
              .
            </li>
            <li>
              Bound number:{" "}
              {data.channelCheckFailed
                ? "could not check"
                : data.accountBound
                  ? "saved, live connection still needs verification"
                  : "not linked"}
              .
            </li>
            <li>
              Database allowance check:{" "}
              {data.allowanceRpcReady
                ? "responding, atomic limit enforcement still needs acceptance"
                : "unavailable - sending must stay paused"}
              {data.allowanceReference ? ` (${data.allowanceReference})` : ""}.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            These checks do not connect accounts or send anything. A present key or enabled switch
            is not proof of delivery, free capacity, consent or approval to activate.
          </p>
        </>
      )}
      <Button variant="outline" className="mt-4" onClick={() => void refresh()}>
        Refresh activation checks
      </Button>
    </section>
  );
}
