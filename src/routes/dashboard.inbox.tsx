import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { listConversations, listMessages, updateConversation, type InboxConversation, type InboxMessage } from "@/lib/inbox.functions";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { conversations as demoConversations, type Conversation } from "@/lib/mock-data";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/inbox")({
  head: () => dashMeta("Inbox", "Every guest message across WhatsApp, Instagram, email and Facebook."),
  component: InboxPage,
});

type Urgency = "High" | "Medium" | "Normal";

const urgencyTone: Record<Urgency, string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-gold-soft text-foreground",
  Normal: "bg-secondary text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  needs_approval: "Needs approval",
  resolved: "Resolved",
};

const statusTone: Record<string, string> = {
  open: "bg-secondary text-foreground",
  needs_approval: "bg-gold-soft text-foreground",
  resolved: "bg-forest-soft text-forest",
};

const urgencyLabel = (v: string): Urgency => (v === "high" ? "High" : v === "medium" ? "Medium" : "Normal");
const intentLabel = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const team = ["Unassigned", "Thabo (Manager)", "Lerato (Shift lead)", "Host desk", "Kitchen"] as const;

const urgencyFilters = ["All", "High", "Medium", "Normal"] as const;
const statusFilters = ["All", "Open", "Needs approval", "Resolved"] as const;
const statusFilterKey: Record<string, string> = {
  Open: "open",
  "Needs approval": "needs_approval",
  Resolved: "resolved",
};

const clock = (iso: string) => {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

/** Demo threads shown until real WhatsApp messages arrive. */
function demoToInbox(c: Conversation): InboxConversation {
  const urgency = c.intent === "Complaint" || c.status === "Failed" ? "high" : c.intent === "Booking" || c.intent === "Catering" ? "medium" : "normal";
  return {
    id: `demo-${c.id}`,
    chatId: c.id,
    guestName: c.name,
    guestPhone: null,
    status: c.status === "Needs approval" ? "needs_approval" : "open",
    urgency,
    intent: c.intent.toLowerCase(),
    summary: null,
    nextAction: null,
    assignee: null,
    unread: c.unread ? 1 : 0,
    lastMessage: c.preview,
    lastMessageAt: new Date().toISOString(),
  };
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;

  const [live, setLive] = useState<InboxConversation[] | null>(null);
  const [thread, setThread] = useState<InboxMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<(typeof urgencyFilters)[number]>("All");
  const [status, setStatus] = useState<(typeof statusFilters)[number]>("All");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const rows = await listConversations({ data: { tenantId } });
      setLive(rows);
    } catch {
      setLive([]);
    }
  }, [ready, tenantId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const isDemo = live !== null && live.length === 0;
  const rows = useMemo(() => (live && live.length ? live : demoConversations.map(demoToInbox)), [live]);

  const active = rows.find((c) => c.id === activeId) ?? null;
  const activeIsLive = Boolean(active && !active.id.startsWith("demo-"));

  useEffect(() => {
    if (!active) return setThread([]);
    if (!activeIsLive) {
      const demo = demoConversations.find((d) => `demo-${d.id}` === active.id);
      setThread(
        (demo?.messages ?? []).map((m, i) => ({
          id: String(i),
          direction: m.from === "guest" ? "in" : "out",
          body: m.body,
          sentAt: new Date().toISOString(),
        })),
      );
      return;
    }
    let cancelled = false;
    const load = async () => {
      const msgs = await listMessages({ data: { tenantId, conversationId: active.id } });
      if (!cancelled) setThread(msgs);
    };
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [active, activeIsLive, tenantId]);

  const patch = async (c: InboxConversation, change: { assignee?: string | null; status?: "open" | "needs_approval" | "resolved" }) => {
    setLive((prev) => (prev ? prev.map((r) => (r.id === c.id ? { ...r, ...change } : r)) : prev));
    if (c.id.startsWith("demo-")) return;
    await updateConversation({ data: { tenantId, conversationId: c.id, ...change } });
    void refresh();
  };

  const openThread = async (c: InboxConversation) => {
    setActiveId(c.id);
    if (!c.id.startsWith("demo-") && c.unread > 0) {
      setLive((prev) => (prev ? prev.map((r) => (r.id === c.id ? { ...r, unread: 0 } : r)) : prev));
      await updateConversation({ data: { tenantId, conversationId: c.id, markRead: true } });
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (status !== "All" && c.status !== statusFilterKey[status]) return false;
      if (urgency !== "All" && urgencyLabel(c.urgency) !== urgency) return false;
      if (q && !`${c.guestName} ${c.lastMessage ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, urgency, status, search]);

  const openCount = rows.filter((c) => c.status !== "resolved").length;

  return (
    <>
      <PageTitle title="Inbox" sub="Guest messages from every channel, with AI replies ready." />

      {isDemo && (
        <p className="mb-4 rounded-xl border border-dashed border-border bg-card/60 px-4 py-2.5 text-xs text-muted-foreground">
          Showing sample chats. Real WhatsApp messages appear here automatically once your number is linked.
        </p>
      )}

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
            const u = urgencyLabel(c.urgency);
            const isResolved = c.status === "resolved";
            return (
              <li key={c.id}>
                <div className={`rounded-xl border p-3 ${c.id === activeId ? "border-primary bg-card" : "border-border bg-card/70"} ${isResolved ? "opacity-70" : ""}`}>
                  <button type="button" onClick={() => void openThread(c)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">
                        {c.unread > 0 && !isResolved && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />}
                        {c.guestName}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">{clock(c.lastMessageAt)}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.lastMessage}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-secondary px-2 py-0.5">{intentLabel(c.intent)}</span>
                      <span className={`rounded-full px-2 py-0.5 ${urgencyTone[u]}`}>{u}</span>
                      <span className={`rounded-full px-2 py-0.5 ${statusTone[c.status] ?? "bg-secondary"}`}>
                        {statusLabel[c.status] ?? c.status}
                      </span>
                      {c.assignee && c.assignee !== "Unassigned" && (
                        <span className="rounded-full bg-secondary px-2 py-0.5">{c.assignee}</span>
                      )}
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2">
                    <select
                      value={c.assignee ?? "Unassigned"}
                      onChange={(e) => void patch(c, { assignee: e.target.value === "Unassigned" ? null : e.target.value })}
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
                      onClick={() => void patch(c, { status: isResolved ? "open" : "resolved" })}
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
                  {active.guestName}
                  {active.guestPhone && <span className="text-sm text-muted-foreground"> · {active.guestPhone}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${urgencyTone[urgencyLabel(active.urgency)]}`}>
                    {urgencyLabel(active.urgency)}
                  </span>
                  <select
                    value={active.assignee ?? "Unassigned"}
                    onChange={(e) => void patch(active, { assignee: e.target.value === "Unassigned" ? null : e.target.value })}
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
                    onClick={() => void patch(active, { status: active.status === "resolved" ? "open" : "resolved" })}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                  >
                    {active.status === "resolved" ? "Reopen" : "Mark resolved"}
                  </button>
                </div>
              </div>
              {thread.length === 0 && <p className="text-sm text-muted-foreground">No messages in this chat yet.</p>}
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.direction === "in" ? "bg-card" : "ml-auto bg-primary text-primary-foreground"}`}
                >
                  {m.body}
                  <p className="mt-1 text-[10px] opacity-70">{clock(m.sentAt)}</p>
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
