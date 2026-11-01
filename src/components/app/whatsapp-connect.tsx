import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectWhatsApp, getWhatsAppStatus } from "@/lib/whatsapp.functions";
import type { RestaurantProfile } from "@/lib/restaurant-profile";
type Props = { profile: RestaurantProfile; update: (p: Partial<RestaurantProfile>) => void };
export function WhatsAppConnect({ profile, update }: Props) {
  const connect = useServerFn(connectWhatsApp);
  const check = useServerFn(getWhatsAppStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [linked, setLinked] = useState(false);
  const [accountId, setAccountId] = useState(profile.waAccountId ?? "");
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await connect({ data: { tenantId: profile.slug, restaurantName: profile.name } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAccountId(res.data.waAccountId);
      if (res.data.authUrl) window.location.assign(res.data.authUrl);
    } catch {
      setError("Connection could not be started. No number was linked.");
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await check({
        data: { tenantId: profile.slug, waAccountId: accountId || profile.slug },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setChecked(true);
      setLinked(res.data.isConnected);
      if (res.data.isConnected) {
        setAccountId(res.data.waAccountId);
        update({ waAccountId: res.data.waAccountId, waConnected: true });
      }
    } catch {
      setError("Could not verify the number. Please try checking again later.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
        <div className="flex items-center gap-2 font-medium">
          {linked ? (
            <CheckCircle2 className="size-5 text-forest" />
          ) : (
            <Smartphone className="size-5" />
          )}
          {linked ? "WhatsApp number verified" : "Link your restaurant's WhatsApp"}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {linked
            ? "Incoming customer messages can appear in your Flavourly inbox. Live replies stay paused until enabled by your team."
            : "Use the secure connection page, then return here to check your number. An old connection is not treated as verified."}
        </p>
      </div>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>Only reply to customers who messaged your restaurant first.</li>
        <li>Replies stop after 24 hours. No paid templates or cold messages.</li>
        <li>
          Starter pilot: proposed allowance up to 100 trial replies, counted within 500 monthly
          replies; pilot cap 25 per day. Sending remains paused until these limits are verified.
        </li>
        <li>
          Menu answers use your saved menu. Bookings need a capacity check. Ask for a manager at any
          time.
        </li>
      </ul>
      <div className="flex flex-wrap gap-3">
        {!linked && (
          <Button onClick={start} disabled={busy} className="rounded-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
            Connect WhatsApp
          </Button>
        )}
        <Button onClick={refresh} disabled={busy} variant="outline" className="rounded-full">
          Check connection
        </Button>
      </div>
      {checked && !linked && (
        <p className="text-sm text-muted-foreground">No restaurant number is connected yet.</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
