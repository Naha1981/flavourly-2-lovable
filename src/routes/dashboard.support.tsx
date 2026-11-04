import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { askSupport, getSupportChat, resumeAssistant } from "@/lib/support-chat.functions";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/support")({
  head: () => dashMeta("Support", "Ask about your menu, policies and bookings. A person steps in when the assistant isn't sure."),
  component: SupportPage,
});

type Msg = { id: string; role: string; body: string; needs_human: boolean; created_at: string };

function SupportPage() {
  const { profile, ready } = useRestaurantProfile();
  const get = useServerFn(getSupportChat);
  const ask = useServerFn(askSupport);
  const resume = useServerFn(resumeAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState("ai");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const tenantId = profile.slug;

  useEffect(() => {
    if (!ready || !tenantId) return;
    get({ data: { tenantId } }).then((r) => { setMsgs(r.messages as Msg[]); setStatus(r.status); }).catch(() => setErr("Couldn't load your chat."));
  }, [ready, tenantId, get]);

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setErr(null); setText("");
    setMsgs((m) => [...m, { id: "pending", role: "owner", body: q, needs_human: false, created_at: "" }]);
    try {
      const r = await ask({ data: { tenantId, question: q } });
      setMsgs(r.messages as Msg[]); setStatus(r.status);
    } catch {
      setErr("Message not sent. Please try again."); setText(q);
      setMsgs((m) => m.filter((x) => x.id !== "pending"));
    } finally { setBusy(false); box.current?.focus(); }
  };

  if (!ready) return null;
  if (!tenantId) return <PageTitle title="Support" sub="Set up your restaurant first." />;

  return (
    <>
      <PageTitle title="Support" sub="Ask about your menu, house policies or upcoming bookings. If the assistant isn't sure, a Flavourly team member takes over." />
      {status === "waiting_human" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <span>A team member has this conversation and will reply here.</span>
          <Button size="sm" variant="outline" onClick={async () => { const r = await resume({ data: { tenantId } }); setStatus(r.status); }}>
            Back to the assistant
          </Button>
        </div>
      )}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4" aria-live="polite">
        {msgs.length === 0 && <p className="text-sm text-muted-foreground">Try: "Which dishes are vegan?" or "How many bookings do we have this Friday?"</p>}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "owner" ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground" : "max-w-[85%] text-sm text-foreground"}>
            {m.role !== "owner" && <div className="mb-0.5 text-xs font-medium text-muted-foreground">{m.role === "staff" ? "Flavourly team" : "Assistant"}{m.needs_human ? " · handed to a person" : ""}</div>}
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Assistant is thinking…</p>}
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <Textarea ref={box} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <Button type="submit" disabled={busy || !text.trim()}>Send</Button>
      </form>
    </>
  );
}
