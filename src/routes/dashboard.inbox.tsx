import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { conversations } from "@/lib/mock-data";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/inbox")({
  head: () => dashMeta("Inbox", "Every guest message across WhatsApp, Instagram, email and Facebook."),
  component: InboxPage,
});

const statusTone: Record<string, string> = {
  Sent: "bg-forest-soft text-forest",
  "Needs approval": "bg-gold-soft text-foreground",
  "AI Draft": "bg-secondary text-foreground",
  Failed: "bg-destructive/10 text-destructive",
};

function InboxPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = conversations.find((c) => c.id === activeId);

  return (
    <>
      <PageTitle title="Inbox" sub="Guest messages from every channel, with AI replies ready." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <ul className={`grid content-start gap-2 ${active ? "hidden lg:grid" : ""}`}>
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`w-full rounded-xl border p-3 text-left ${c.id === activeId ? "border-primary bg-card" : "border-border bg-card/70"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-foreground">{c.unread && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />}{c.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.time}</span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{c.preview}</p>
                <div className="mt-2 flex gap-1.5 text-[11px]">
                  <span className="rounded-full bg-secondary px-2 py-0.5">{c.channel}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">{c.intent}</span>
                  <span className={`rounded-full px-2 py-0.5 ${statusTone[c.status]}`}>{c.status}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <section className={`glass-card min-h-80 rounded-2xl border border-border p-5 ${active ? "" : "hidden lg:block"}`}>
          {!active ? (
            <p className="text-sm text-muted-foreground">Pick a conversation to read it.</p>
          ) : (
            <div className="grid gap-3">
              <button type="button" className="w-fit text-sm text-primary lg:hidden" onClick={() => setActiveId(null)}>← All messages</button>
              <h2 className="font-medium text-foreground">{active.name} <span className="text-sm text-muted-foreground">· {active.channel}</span></h2>
              {active.messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "guest" ? "bg-card" : "ml-auto bg-primary text-primary-foreground"}`}>
                  {m.body}
                  <p className="mt-1 text-[10px] opacity-70">{m.time}</p>
                </div>
              ))}
              <Link to="/dashboard/replies" className="mt-2 text-sm font-medium text-primary">Analyse or draft a reply →</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
