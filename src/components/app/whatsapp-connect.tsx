import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  connectWhatsApp,
  getWhatsAppStatus,
  inspectMessagingKey,
  saveMessagingKey,
  getMessagingSetup,
} from "@/lib/whatsapp.functions";
import type { RestaurantProfile } from "@/lib/restaurant-profile";
type Props = { profile: RestaurantProfile; update: (p: Partial<RestaurantProfile>) => void };
export function WhatsAppConnect({ profile, update }: Props) {
  const connect = useServerFn(connectWhatsApp);
  const inspect = useServerFn(inspectMessagingKey),
    save = useServerFn(saveMessagingKey),
    setup = useServerFn(getMessagingSetup);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [owned, setOwned] = useState(false),
    [keySaved, setKeySaved] = useState(false),
    [key, setKey] = useState("");
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]),
    [selected, setSelected] = useState("");
  useEffect(() => {
    void setup({ data: { tenantId: profile.slug } })
      .then((s) => {
        setOwned(s.enabled);
        setKeySaved(s.saved);
        setNeedsAttention(Boolean(s.needsAttention));
      })
      .catch(() => {});
  }, [profile.slug, setup]);
  const validateKey = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await inspect({ data: { tenantId: profile.slug, key } });
      setProfiles(p);
      if (p.length === 1) setSelected(p[0]!.id);
    } catch {
      setError("Could not verify this connection key. Check your messaging account and try again.");
    } finally {
      setBusy(false);
    }
  };
  const storeKey = async () => {
    setBusy(true);
    setError(null);
    try {
      await save({ data: { tenantId: profile.slug, key, profileId: selected } });
      setKey("");
      setKeySaved(true);
    } catch {
      setError(
        "Setup could not be saved. Existing connections were not replaced. Ask the team to check before retrying.",
      );
    } finally {
      setBusy(false);
    }
  };
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
            ? "Your number is verified. Turn on auto-replies under Venue, rewards and auto-replies, then ask a colleague to send your business number a test enquiry. Check Activation checks below before relying on live replies."
            : "Connect your own WhatsApp Business number through the secure setup. Keep using your Business app. You choose and verify your number; no NahaLabs number is substituted."}
        </p>
      </div>
      {owned && !keySaved && !profile.waAccountId && (
        <section className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-medium">Set up your messaging account</h3>
          <p className="text-sm text-muted-foreground">
            Save time answering guests and turn enquiries into bookings. Create your business
            messaging account, then save its connection key here. The free allowance must be checked
            before a number is connected. No card or paid template is added by Flavourly.
          </p>
          <a
            href="https://zernio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Open messaging account setup
          </a>
          <label className="grid gap-1 text-sm">
            Connection key
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="rounded border bg-background p-2"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            In your messaging dashboard, open API keys and create a key for your business profile.
            Paste it only in this secure form, never in chat. It is encrypted and is not shown
            again.
          </p>
          <Button onClick={validateKey} disabled={busy || key.length < 20} variant="outline">
            Check my key
          </Button>
          {profiles.length > 0 && (
            <>
              <label className="grid gap-1 text-sm">
                Business profile
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="rounded border bg-background p-2"
                >
                  <option value="">Choose your profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={storeKey} disabled={busy || !selected}>
                Save secure connection
              </Button>
            </>
          )}
        </section>
      )}
      {needsAttention && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm">
          Messaging is paused because your connection needs attention. Ask the team to verify your
          messaging account before reconnecting. No shared number will be used.
        </p>
      )}
      {owned && keySaved && !needsAttention && (
        <p className="text-sm">
          Messaging key saved securely. Connect your WhatsApp Business number, then send an enquiry
          from another phone. Setup is complete only after the reply is delivered.
        </p>
      )}
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>Only reply to customers who messaged your restaurant first.</li>
        <li>Replies stop after 24 hours. No paid templates or cold messages.</li>
        <li>
          Starter pilot: up to 100 trial replies within 500 monthly replies; pilot cap 25 per day.
          Live replies require the activation checks below to pass.
        </li>
        <li>
          Menu answers use your saved menu. Bookings need a capacity check. Ask for a manager at any
          time.
        </li>
      </ul>
      <div className="flex flex-wrap gap-3">
        {!linked && (
          <Button
            onClick={start}
            disabled={busy || (owned && !keySaved && !profile.waAccountId)}
            className="rounded-full"
          >
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
