import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarCheck, Copy, HelpCircle, Loader2, MessageSquareWarning, Send, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftReply } from "@/lib/reply-drafts.functions";
import { sendWhatsAppText } from "@/lib/whatsapp.functions";
import type { RestaurantProfile } from "@/lib/restaurant-profile";

type Intent = "auto" | "booking" | "faq" | "complaint";

const intents: { value: Intent; label: string; icon: typeof Sparkles }[] = [
  { value: "auto", label: "Auto-detect", icon: Sparkles },
  { value: "booking", label: "Booking", icon: CalendarCheck },
  { value: "faq", label: "Question", icon: HelpCircle },
  { value: "complaint", label: "Complaint", icon: MessageSquareWarning },
];

const samples: Record<Exclude<Intent, "auto">, string> = {
  booking: "Hi! Any chance of a table for 6 this Saturday around 7? It's my mom's 60th 🎉",
  faq: "Do you have vegan options and is there parking?",
  complaint: "We waited almost an hour for our mains last night and nobody came to check on us. Really disappointing.",
};

type Props = {
  profile: RestaurantProfile;
  initialMessage?: string;
  onDrafted?: () => void;
  compact?: boolean;
};

export function ReplyDrafter({ profile, initialMessage = "", onDrafted, compact }: Props) {
  const draft = useServerFn(draftReply);
  const send = useServerFn(sendWhatsAppText);

  const [message, setMessage] = useState(initialMessage);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [intent, setIntent] = useState<Intent>("auto");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ intent: string; reply: string } | null>(null);

  const run = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await draft({
        data: {
          message,
          intent,
          guestName: guestName || undefined,
          restaurant: {
            name: profile.name,
            city: profile.city || undefined,
            cuisine: profile.cuisine || undefined,
            hours: profile.hours || undefined,
            averageCheck: profile.averageCheck || undefined,
            ownerName: profile.ownerName || undefined,
            notes: profile.notes || undefined,
          },
        },
      });
      if (!res.ok) setError(res.error);
      else {
        setResult({ intent: res.intent, reply: res.reply });
        onDrafted?.();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!result || !profile.waAccountId) return;
    setSending(true);
    const res = await send({ data: { tenantId: profile.slug, waAccountId: profile.waAccountId, to: guestPhone, text: result.reply } });
    setSending(false);
    if (res.ok) toast.success("Reply sent on WhatsApp.");
    else toast.error(res.error);
  };

  const canSend = profile.waConnected && profile.waAccountId && /^\+?\d{9,15}$/.test(guestPhone);

  return (
    <div className={`grid gap-6 ${compact ? "" : "lg:grid-cols-2"}`}>
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap gap-2">
          {intents.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setIntent(value);
                if (value !== "auto" && !message) setMessage(samples[value]);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                intent === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="guest-msg">Guest message</Label>
          <Textarea
            id="guest-msg"
            rows={compact ? 3 : 5}
            placeholder="Paste what the guest sent — WhatsApp, Instagram, email…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
          />
        </div>
        {!compact && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="guest-name">Guest name (optional)</Label>
              <Input id="guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Lerato" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guest-phone">Guest WhatsApp (to send)</Label>
              <Input id="guest-phone" inputMode="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="27821234567" />
            </div>
          </div>
        )}
        <Button onClick={run} disabled={busy || !message.trim()} size="lg" className="rounded-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {busy ? "Writing in your voice…" : "Draft reply"}
        </Button>
      </div>

      <div className="glass-card grid min-h-56 content-start gap-3 rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Draft for approval</p>
          {result && (
            <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium capitalize text-foreground">{result.intent}</span>
          )}
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!result && !error && (
          <p className="text-sm text-muted-foreground">
            Your draft appears here, written as {profile.name}. Nothing is sent until you approve it.
          </p>
        )}
        {result && (
          <>
            <Textarea
              rows={6}
              value={result.reply}
              onChange={(e) => setResult({ ...result, reply: e.target.value })}
              className="bg-card"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  navigator.clipboard.writeText(result.reply);
                  toast.success("Copied");
                }}
              >
                <Copy className="size-4" /> Copy
              </Button>
              {!compact && (
                <Button size="sm" className="rounded-full" disabled={!canSend || sending} onClick={sendReply}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Approve & send
                </Button>
              )}
            </div>
            {!compact && !profile.waConnected && (
              <p className="text-xs text-muted-foreground">Link WhatsApp in Settings to send straight from here.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
