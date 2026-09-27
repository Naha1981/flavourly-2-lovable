import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { conversations, type Conversation } from "@/lib/mock-data";
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

type Urgency = "High" | "Medium" | "Normal";

const urgencyTone: Record<Urgency, string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-gold-soft text-foreground",
  Normal: "bg-secondary text-muted-foreground",
};

function urgencyOf(c: Conversation): Urgency {
  if (c.intent === "Complaint" || c.status === "Failed") return "High";
  if (c.intent === "Booking" || c.intent === "Catering" || c.status === "Needs approval") return "Medium";
  return "Normal";
}

const team = ["Unassigned", "Thabo (Manager)", "Lerato (Shift lead)", "Host desk", "Kitchen"] as const;
type Assignee = (typeof team)[number];

const urgencyFilters = ["All", "High", "Medium", "Normal"] as const;
const statusFilters = ["All", "Open", "Needs approval", "Resolved"] as const;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function InboxPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<(typeof urgencyFilters)[number]>("All");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");
  const [search, setSearch] = useState("");
  const [assignments, setAssignments] = useState<Record<string, Assignee>>({});
  const [resolved, setResolved] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      const isResolved = Boolean(resolved[c.id]);
      if (status === "Resolved" && !isResolved) return false;
      if (status === "Open" && isResolved) return false;
      if (status === "Needs approval" && (isResolved || c.status !== "Needs approval")) return false;
      if (urgency !== "All" && urgencyOf(c) !== urgency) return false;
      if (q && !`${c.name} ${c.preview}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [urgency, status, search, resolved]);

  const active = conversations.find((c) => c.id === activeId);
  const openCount = conversations.filter((c) => !resolved[c.id]).length;

  return (
    <>
      <PageTitle title="Inbox" sub="Guest messages from every channel, with AI replies ready." />

      <div className="mb-4 grid gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a guest or message…"
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Urgency</span>
          {urgencyFilters.map((u) => (
            <Chip key={u} active={urgency === u} onClick={() => setUrgency(u)}>
              {u}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Status</span>
          {statusFilters.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {visible.length} showing · {openCount} open
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <ul className={`grid content-start gap-2 ${active ? "hidden lg:grid" : ""}`}>
          {visible.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing matches these filters.
            </li>
          )}
          {visible.map((c) => {
            const u = urgencyOf(c);
            const isResolved = Boolean(resolved[c.id]);
            return (
              <li key={c.id}>
                <div
                  className={`rounded-xl border p-3 ${c.id === activeId ? "border-primary bg-card" : "border-border bg-card/70"} ${isResolved ? "opacity-70" : ""}`}
                >
                  <button type="button" onClick={() => setActiveId(c.id)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">
                        {c.unread && !isResolved && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />}
                        {c.name}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.preview}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-secondary px-2 py-0.5">{c.channel}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">{c.intent}</span>
                      <span className={`rounded-full px-2 py-0.5 ${urgencyTone[u]}`}>{u}</span>
                      <span className={`rounded-full px-2 py-0.5 ${isResolved ? "bg-forest-soft text-forest" : statusTone[c.status]}`}>
                        {isResolved ? "Resolved" : c.status}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
                    <select
                      value={assignments[c.id] ?? "Unassigned"}
                      onChange={(e) => setAssignments((a) => ({ ...a, [c.id]: e.target.value as Assignee }))}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      {team.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setResolved((r) => ({ ...r, [c.id]: !r[c.id] }))}
                      className="ml-auto rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                    >
                      {isResolved ? "Reopen" : "Mark resolved"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <section className={`glass-card min-h-80 rounded-2xl border border-border p-5 ${active ? "" : "hidden lg:block"}`}>
          {!active ? (
            <p className="text-sm text-muted-foreground">Pick a conversation to read it.</p>
          ) : (
            <div className="grid gap-3">
              <button type="button" className="w-fit text-sm text-primary lg:hidden" onClick={() => setActiveId(null)}>
                ← All messages
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium text-foreground">
                  {active.name} <span className="text-sm text-muted-foreground">· {active.channel}</span>
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${urgencyTone[urgencyOf(active)]}`}>{urgencyOf(active)}</span>
                  <select
                    value={assignments[active.id] ?? "Unassigned"}
                    onChange={(e) => setAssignments((a) => ({ ...a, [active.id]: e.target.value as Assignee }))}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                  >
                    {team.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setResolved((r) => ({ ...r, [active.id]: !r[active.id] }))}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    {resolved[active.id] ? "Reopen" : "Mark resolved"}
                  </button>
                </div>
              </div>
              {active.messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "guest" ? "bg-card" : "ml-auto bg-primary text-primary-foreground"}`}
                >
                  {m.body}
                  <p className="mt-1 text-[10px] opacity-70">{m.time}</p>
                </div>
              ))}
              <Link to="/dashboard/replies" className="mt-2 text-sm font-medium text-primary">
                Analyse or draft a reply →
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
