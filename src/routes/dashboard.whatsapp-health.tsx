import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, Server, Smartphone, Webhook, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { getWhatsAppHealth, retryWebhookEvent, type WhatsAppHealth } from "@/lib/whatsapp-health.functions";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/whatsapp-health")({
  head: () => dashMeta("WhatsApp health", "Check your WhatsApp link, recent message deliveries and retry failed ones safely."),
  component: HealthPage,
});

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const statusTone: Record<string, string> = {
  processed: "bg-forest-soft text-forest",
  retried: "bg-forest-soft text-forest",
  failed: "bg-destructive/10 text-destructive",
  retrying: "bg-gold-soft text-foreground",
};
const statusLabel: Record<string, string> = {
  processed: "Delivered",
  retried: "Delivered on retry",
  failed: "Failed",
  retrying: "Retrying…",
};

function Card({ icon: Icon, title, ok, line, sub }: { icon: typeof Server; title: string; ok: boolean | null; line: string; sub?: string | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {title}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {ok === null ? null : ok ? <CheckCircle2 className="size-5 text-forest" /> : <XCircle className="size-5 text-destructive" />}
        <p className="font-medium text-foreground">{line}</p>
      </div>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function HealthPage() {
  const { profile, ready } = useRestaurantProfile();
  const load = useServerFn(getWhatsAppHealth);
  const retry = useServerFn(retryWebhookEvent);
  const [health, setHealth] = useState<WhatsAppHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setHealth(await load({ data: { tenantId: profile.slug, waAccountId: profile.waAccountId } }));
      setError(null);
    } catch {
      setError("Couldn't load the health check. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [load, profile.slug, profile.waAccountId]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [ready, refresh]);

  const doRetry = async (eventId: string) => {
    setBusy(eventId);
    setNotice(null);
    try {
      const res = await retry({ data: { tenantId: profile.slug, eventId } });
      setNotice(res.message);
    } catch {
      setNotice("Retry couldn't start. Try again shortly.");
    }
    setBusy(null);
    void refresh();
  };

  if (!ready) return null;
  const acc = health?.account;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle title="WhatsApp health" sub="Is your number linked, and are guest messages reaching Flavourly?" />
        <Button variant="outline" size="sm" className="rounded-full" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check now
        </Button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          icon={Server}
          title="WhatsApp service"
          ok={health ? health.operator.reachable : null}
          line={!health ? "Checking…" : health.operator.reachable ? "Online" : "Not reachable"}
          sub={health?.operator.error ?? (health?.operator.latencyMs != null ? `Answered in ${health.operator.latencyMs} ms` : undefined)}
        />
        <Card
          icon={Smartphone}
          title="Your number"
          ok={!health ? null : acc ? acc.isConnected : false}
          line={!health ? "Checking…" : !acc ? "Not linked yet" : acc.isConnected ? "Linked" : acc.status.replace(/_/g, " ")}
          sub={acc?.error ?? (acc?.phoneNumber ? `+${acc.phoneNumber.replace(/\D/g, "")}` : undefined)}
        />
        <Card
          icon={Webhook}
          title="Message deliveries"
          ok={!health ? null : health.counts.failed === 0}
          line={!health ? "Checking…" : `${health.counts.processed + health.counts.retried} delivered · ${health.counts.failed} failed`}
          sub={health ? `Last received ${when(health.lastDeliveryAt)}` : undefined}
        />
      </div>

      {health && !acc && (
        <p className="mt-4 text-sm text-muted-foreground">
          Link your restaurant's WhatsApp in{" "}
          <Link to="/dashboard/settings" className="font-medium text-primary hover:underline">Settings</Link> to start receiving guest messages.
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-medium text-foreground">Recent deliveries</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The last 50 batches of messages your WhatsApp service sent us. Retrying never duplicates a message or sends a second auto-reply.
        </p>
        {notice && <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">{notice}</p>}

        <div className="mt-4 grid gap-2">
          {health && health.events.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No deliveries yet. Send a WhatsApp message to your restaurant number to test.
            </p>
          )}
          {health?.events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[e.status] ?? "bg-secondary text-foreground"}`}>
                {statusLabel[e.status] ?? e.status}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-foreground">
                  {when(e.receivedAt)} · {e.saved}/{e.eventCount} saved
                  {e.retryCount > 0 && <span className="text-muted-foreground"> · {e.retryCount} retr{e.retryCount === 1 ? "y" : "ies"}</span>}
                </p>
                {e.error && <p className="truncate text-xs text-destructive">{e.error}</p>}
              </div>
              {e.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={!e.canRetry || busy !== null}
                  onClick={() => doRetry(e.id)}
                >
                  {busy === e.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  {e.canRetry ? "Retry" : "Limit reached"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
