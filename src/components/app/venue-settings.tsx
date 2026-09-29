import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getVenue, saveVenue } from "@/lib/menu.functions";
import type { RestaurantProfile } from "@/lib/restaurant-profile";

/** Venue details behind the public menu, the GPS reward check and WhatsApp auto-replies. */
export function VenueSettings({ profile }: { profile: RestaurantProfile }) {
  const load = useServerFn(getVenue);
  const save = useServerFn(saveVenue);
  const [form, setForm] = useState({
    whatsappPhone: "",
    managerPhone: "",
    googleReviewUrl: "",
    latitude: "",
    longitude: "",
    radius: "500",
    autoReplies: false,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load({ data: { tenantId: profile.slug } }).then((v) => {
      if (!v) return;
      setForm({
        whatsappPhone: v.whatsappPhone ?? "",
        managerPhone: v.managerPhone ?? profile.managerPhone ?? "",
        googleReviewUrl: v.googleReviewUrl ?? "",
        latitude: v.latitude?.toString() ?? "",
        longitude: v.longitude?.toString() ?? "",
        radius: String(v.geofenceRadiusM),
        autoReplies: v.autoRepliesEnabled,
      });
    });
  }, [load, profile.slug]);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const useMyLocation = () => {
    setMsg(null);
    navigator.geolocation?.getCurrentPosition(
      (p) =>
        setForm((f) => ({
          ...f,
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
        })),
      () => setMsg("Couldn't read your location. Enter the coordinates manually."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const lat = form.latitude.trim() === "" ? null : Number(form.latitude);
    const lon = form.longitude.trim() === "" ? null : Number(form.longitude);
    try {
      const res = await save({
        data: {
          tenantId: profile.slug,
          name: profile.name,
          whatsappPhone: form.whatsappPhone.trim() || null,
          managerPhone: form.managerPhone.trim() || null,
          googleReviewUrl: form.googleReviewUrl.trim() || null,
          latitude: lat !== null && Number.isFinite(lat) ? lat : null,
          longitude: lon !== null && Number.isFinite(lon) ? lon : null,
          geofenceRadiusM: Number(form.radius) || 500,
          autoRepliesEnabled: form.autoReplies,
        },
      });
      setMsg(res.ok ? "Saved." : res.error);
    } catch {
      setMsg("Check the phone number and link formats, then try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="wa-phone">Restaurant WhatsApp number</Label>
          <Input
            id="wa-phone"
            inputMode="tel"
            placeholder="27821234567"
            value={form.whatsappPhone}
            onChange={(e) => set("whatsappPhone", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mgr-phone">Manager WhatsApp (gets alerts)</Label>
          <Input
            id="mgr-phone"
            inputMode="tel"
            placeholder="27821234567"
            value={form.managerPhone}
            onChange={(e) => set("managerPhone", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="g-url">Google review link</Label>
          <Input
            id="g-url"
            inputMode="url"
            placeholder="https://g.page/r/…"
            value={form.googleReviewUrl}
            onChange={(e) => set("googleReviewUrl", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            inputMode="decimal"
            value={form.latitude}
            onChange={(e) => set("latitude", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lon">Longitude</Label>
          <Input
            id="lon"
            inputMode="decimal"
            value={form.longitude}
            onChange={(e) => set("longitude", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="radius">Reward check radius (metres)</Label>
          <Input
            id="radius"
            inputMode="numeric"
            value={form.radius}
            onChange={(e) => set("radius", e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={useMyLocation}>
            <Crosshair className="size-4" /> Use my current location
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl bg-card p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Automatic WhatsApp replies</p>
          <p className="text-xs text-muted-foreground">
            Handles table bookings, JOIN, BALANCE and REDEEM. Anything else stays in the inbox for
            your team.
          </p>
        </div>
        <Switch
          checked={form.autoReplies}
          onCheckedChange={(v) => set("autoReplies", v)}
          aria-label="Automatic WhatsApp replies"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save venue details"}
        </Button>
        {msg && (
          <span role="status" className="text-sm text-muted-foreground">
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
