import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Gauge, Loader2, ScanSearch, Smile, Tag, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyseMessage } from "@/lib/message-triage.functions";
import type { Triage } from "@/lib/message-triage.server";
import type { RestaurantProfile } from "@/lib/restaurant-profile";

const tone = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-gold-soft text-foreground",
  low: "bg-forest-soft text-forest",
  negative: "bg-destructive/10 text-destructive",
  neutral: "bg-secondary text-foreground",
  positive: "bg-forest-soft text-forest",
} as const;

export function MessageTriage({ profile }: { profile: RestaurantProfile }) {
  const analyse = useServerFn(analyseMessage);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Triage | null>(null);

  const run = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await analyse({
        data: { message, restaurant: { name: profile.name, hours: profile.hours || undefined, notes: profile.notes || undefined } },
      });
      if (res.ok) setResult(res);
      else setError(res.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <Textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Paste a guest message to see what it needs…"
          aria-label="Guest message to analyse"
        />
        <Button onClick={run} disabled={busy || !message.trim()} size="lg" className="rounded-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
          {busy ? "Reading the message…" : "Analyse message"}
        </Button>
      </div>
      <div className="glass-card grid min-h-56 content-start gap-4 rounded-2xl border border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What it needs</p>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!result && !error && <p className="text-sm text-muted-foreground">Intent, urgency, mood and the next step appear here.</p>}
        {result && (
          <>
            <div className="flex flex-wrap gap-2 text-xs font-medium capitalize">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1"><Tag className="size-3" />{result.intent}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${tone[result.urgency]}`}><Gauge className="size-3" />{result.urgency} urgency</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${tone[result.sentiment]}`}><Smile className="size-3" />{result.sentiment}</span>
            </div>
            {result.summary && <p className="text-sm text-muted-foreground">{result.summary}</p>}
            <div className="rounded-xl border border-gold/30 bg-gold-soft/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ArrowRight className="size-3" /> Next step</p>
              <p className="mt-1 font-medium text-foreground">{result.nextAction}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="size-3" /> {result.owner}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
