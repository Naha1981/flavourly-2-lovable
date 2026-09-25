import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, RefreshCw, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  connectWhatsApp,
  getWhatsAppStatus,
  refreshWhatsAppQr,
  requestPairingCode,
} from "@/lib/whatsapp.functions";
import type { RestaurantProfile } from "@/lib/restaurant-profile";

type Props = {
  profile: RestaurantProfile;
  update: (p: Partial<RestaurantProfile>) => void;
};

export function WhatsAppConnect({ profile, update }: Props) {
  const connect = useServerFn(connectWhatsApp);
  const getStatus = useServerFn(getWhatsAppStatus);
  const refresh = useServerFn(refreshWhatsAppQr);
  const pair = useServerFn(requestPairingCode);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<string>(profile.waConnected ? "connected" : "idle");
  const [phone, setPhone] = useState<string | null>(null);
  const [mode, setMode] = useState<"qr" | "code">("qr");
  const [pairPhone, setPairPhone] = useState(profile.managerPhone);
  const [code, setCode] = useState<string | null>(null);
  const failures = useRef(0);

  const tenantId = profile.slug;
  const accountId = profile.waAccountId;

  // Poll every 3s — well under the ~20s QR refresh cadence.
  useEffect(() => {
    if (!accountId || state === "connected") return;
    let cancelled = false;
    const tick = async () => {
      const res = await getStatus({ data: { tenantId, waAccountId: accountId } });
      if (cancelled) return;
      if (!res.ok) {
        failures.current += 1;
        if (failures.current >= 5) setError(res.error);
        return;
      }
      failures.current = 0;
      setError(null);
      setState(res.data.status);
      setQr(res.data.qrCode);
      setPhone(res.data.phoneNumber);
      if (res.data.isConnected) update({ waConnected: true });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accountId, state, tenantId, getStatus, update]);

  const start = async () => {
    setStarting(true);
    setError(null);
    const res = await connect({ data: { tenantId, restaurantName: profile.name } });
    setStarting(false);
    if (!res.ok) return setError(res.error);
    update({ waAccountId: res.data.waAccountId, waConnected: res.data.status === "connected" });
    setState(res.data.status);
  };

  const newQr = async () => {
    if (!accountId) return;
    setQr(null);
    const res = await refresh({ data: { tenantId, waAccountId: accountId } });
    if (!res.ok) setError(res.error);
  };

  const getCode = async () => {
    if (!accountId) return;
    setError(null);
    const res = await pair({ data: { tenantId, waAccountId: accountId, phoneNumber: pairPhone } });
    if (!res.ok) return setError(res.error);
    setCode(res.data.pairingCode ?? res.data.code ?? null);
  };

  if (state === "connected" || profile.waConnected) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-forest/20 bg-forest-soft/60 p-5">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-forest" />
        <div>
          <p className="font-medium text-foreground">WhatsApp is linked</p>
          <p className="text-sm text-muted-foreground">
            {phone ? `+${phone.replace(/\D/g, "")} · ` : ""}Guest messages will now arrive in your Flavourly inbox.
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-medium text-primary hover:underline"
            onClick={() => {
              update({ waConnected: false, waAccountId: null });
              setState("idle");
            }}
          >
            Link a different number
          </button>
        </div>
      </div>
    );
  }

  if (!accountId) {
    return (
      <div className="grid gap-4">
        <ol className="grid gap-3 text-sm text-muted-foreground">
          <li>1. Keep your restaurant's WhatsApp phone nearby.</li>
          <li>2. We'll show a code on this screen.</li>
          <li>3. On the phone: Settings → Linked devices → Link a device, then scan.</li>
        </ol>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button onClick={start} disabled={starting} size="lg" className="w-full rounded-full sm:w-auto">
          {starting ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
          {starting ? "Preparing your link…" : "Show my link code"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="inline-flex w-fit rounded-full border border-border bg-secondary p-1 text-sm">
        {(["qr", "code"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "qr" ? "Scan QR" : "Use phone number"}
          </button>
        ))}
      </div>

      {mode === "qr" ? (
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div className="grid size-[232px] place-items-center rounded-2xl border border-border bg-card p-4">
            {qr ? (
              <QRCodeSVG value={qr} size={200} level="L" marginSize={0} />
            ) : (
              <div className="grid place-items-center gap-2 text-center text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                {state === "qr_expired" ? "Code expired" : "Waiting for code…"}
              </div>
            )}
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <p>
              Open WhatsApp on the restaurant phone → <strong className="text-foreground">Settings</strong> →{" "}
              <strong className="text-foreground">Linked devices</strong> → <strong className="text-foreground">Link a device</strong>.
            </p>
            <p>The code refreshes on its own every 20 seconds. Keep this screen open until it turns green.</p>
            <Button variant="outline" size="sm" className="w-fit rounded-full" onClick={newQr}>
              <RefreshCw className="size-4" /> New code
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:max-w-sm">
          <Label htmlFor="pair-phone">Restaurant WhatsApp number</Label>
          <Input id="pair-phone" inputMode="tel" placeholder="27821234567" value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
          <Button onClick={getCode} className="rounded-full">Get 8-digit code</Button>
          {code && (
            <div className="rounded-xl border border-gold/30 bg-gold-soft/50 p-4 text-center">
              <p className="font-mono text-2xl tracking-[0.3em] text-foreground">{code}</p>
              <p className="mt-1 text-xs text-muted-foreground">Linked devices → Link with phone number instead</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
