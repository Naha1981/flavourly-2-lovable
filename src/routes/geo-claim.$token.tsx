import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getClaim, redeemClaim } from "@/lib/menu.functions";
import { formatZAR } from "@/lib/south-africa";

export const Route = createFileRoute("/geo-claim/$token")({
  head: () => ({
    meta: [{ title: "Redeem your reward — Flavourly" }, { name: "robots", content: "noindex" }],
  }),
  component: GeoClaimPage,
});

type Preview = Awaited<ReturnType<typeof getClaim>>;

function GeoClaimPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getClaim);
  const redeem = useServerFn(redeemClaim);
  const [claim, setClaim] = useState<Preview | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    void load({ data: { token } })
      .then(setClaim)
      .catch(() => setClaim(null));
  }, [load, token]);

  const verify = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("This browser can't share your location. Please ask a team member for help.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await redeem({
            data: { token, lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
          if (res.ok) setCode(res.voucherCode);
          else setError(res.error);
        } catch {
          setError("Couldn't reach the server. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError(
          "Location is switched off for this page. Allow it in your browser settings and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const shown = code ?? (claim?.status === "redeemed" ? claim.voucherCode : null);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="glass-card w-full max-w-sm rounded-2xl border border-border p-6 text-center">
        {claim === undefined && (
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        )}
        {claim === null && (
          <p className="text-sm text-muted-foreground">This reward link isn't valid.</p>
        )}
        {claim && (
          <div className="grid gap-5">
            <div>
              <MapPin className="mx-auto size-6 text-primary" strokeWidth={1.6} />
              <h1 className="mt-2 font-display text-xl text-foreground">{claim.venueName}</h1>
              <p className="text-xs text-muted-foreground">In-restaurant reward</p>
            </div>
            <p className="font-display text-4xl text-forest">
              {formatZAR(claim.discountCents)} off
            </p>

            {shown ? (
              <div className="grid gap-2 rounded-xl bg-forest-soft p-4">
                <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-forest">
                  <CheckCircle2 className="size-4" /> Show this to your waiter
                </p>
                <p className="select-all font-mono text-3xl font-semibold tracking-[0.25em] text-foreground">
                  {shown}
                </p>
              </div>
            ) : claim.status === "expired" || claim.status === "out_of_bounds" ? (
              <p className="text-sm text-muted-foreground">
                This link has expired. Send REDEEM on WhatsApp for a fresh one.
              </p>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  To keep rewards fair, we check you're at the restaurant (within {claim.radius} m).
                </p>
                <Button onClick={verify} disabled={busy}>
                  {busy ? "Checking your location…" : "Verify and show my code"}
                </Button>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
