import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractGuestPreferences, saveGuestPreferences } from "@/lib/guest-preferences.functions";
import { listConversations, listMessages, type InboxConversation } from "@/lib/inbox.functions";
import type { GuestPreferences as Prefs } from "@/lib/guest-preferences.server";
import type { RestaurantProfile } from "@/lib/restaurant-profile";

const groups: { key: keyof Prefs; label: string; alert?: boolean }[] = [
  { key: "allergies", label: "Allergies", alert: true },
  { key: "dietary", label: "Dietary" },
  { key: "seating", label: "Seating" },
  { key: "occasions", label: "Occasions" },
  { key: "favourites", label: "Favourite dishes" },
  { key: "drinks", label: "Drinks" },
];

const spendLabel = { unknown: "Not clear yet", budget: "Price-conscious", mid: "Mid spend", premium: "Premium spender" };

export function GuestPreferences({ profile }: { profile: RestaurantProfile }) {
  const extract = useServerFn(extractGuestPreferences);
  const save = useServerFn(saveGuestPreferences);
  const loadConvos = useServerFn(listConversations);
  const loadMsgs = useServerFn(listMessages);

  const [convos, setConvos] = useState<InboxConversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConvos({ data: { tenantId: profile.slug } })
      .then(setConvos)
      .catch(() => setConvos([]));
  }, [loadConvos, profile.slug]);

  const pickConvo = async (id: string) => {
    setConversationId(id);
    setPrefs(null);
    setSaved(false);
    if (!id) return;
    const c = convos.find((x) => x.id === id);
    setGuestName(c?.guestName ?? "");
    const msgs = await loadMsgs({ data: { tenantId: profile.slug, conversationId: id } }).catch(() => []);
    setText(msgs.map((m) => `${m.direction === "in" ? "Guest" : "Restaurant"}: ${m.body}`).join("\n"));
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setPrefs(null);
    setSaved(false);
    try {
      const res = await extract({
        data: { tenantId: profile.slug, conversation: text, guestName: guestName || undefined, restaurantName: profile.name || "the restaurant" },
      });
      if (!res.ok) setError(res.error);
      else {
        const { ok: _ok, ...p } = res;
        setPrefs(p);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  };

  const store = async () => {
    if (!prefs || !conversationId) return;
    const res = await save({ data: { tenantId: profile.slug, conversationId, preferences: prefs } }).catch(() => ({
      ok: false,
      error: "Couldn't save.",
    }));
    if (res.ok) setSaved(true);
    else setError("error" in res && res.error ? res.error : "Couldn't save.");
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card/70 p-5">
      {convos.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="pref-convo">Pick a chat from your inbox (optional)</Label>
          <select
            id="pref-convo"
            value={conversationId}
            onChange={(e) => pickConvo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— Paste a conversation instead —</option>
            {convos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.guestName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="pref-name">Guest name</Label>
        <Input id="pref-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Naledi M." />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pref-text">WhatsApp conversation</Label>
        <Textarea
          id="pref-text"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Guest: Hi! Table for 2 on Friday, it's our anniversary 🥂\nRestaurant: Lovely! Any dietary needs?\nGuest: My husband is allergic to nuts, and we'd love the patio."}
        />
      </div>
      <Button onClick={run} disabled={busy || text.trim().length < 10} className="w-full rounded-full sm:w-fit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Reading the chat…" : "Find preferences"}
      </Button>

      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {prefs && (
        <div className="grid gap-4 border-t border-border pt-4">
          {prefs.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prefs.tags.map((t) => (
                <span key={t} className="rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-foreground">{t}</span>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(({ key, label, alert }) => {
              const items = prefs[key] as string[];
              return (
                <div key={key} className={`rounded-xl border p-3 ${alert && items.length ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${alert && items.length ? "text-destructive" : "text-muted-foreground"}`}>{label}</p>
                  <p className="mt-1 text-sm text-foreground">{items.length ? items.join(", ") : "None mentioned"}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            Spend: <span className="text-foreground">{spendLabel[prefs.spend]}</span>
          </p>
          {prefs.notes && (
            <div className="rounded-xl border border-forest/20 bg-forest-soft/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-forest">Suggested profile notes</p>
              <p className="mt-1 text-sm text-foreground">{prefs.notes}</p>
            </div>
          )}
          {conversationId ? (
            <Button variant="outline" onClick={store} disabled={saved} className="w-fit rounded-full">
              {saved ? <Check className="size-4" /> : null}
              {saved ? "Saved to guest profile" : "Save to guest profile"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Pick a chat from your inbox above to save these to the guest's profile.</p>
          )}
        </div>
      )}
    </div>
  );
}
