import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAnotherWorkspace, createTeamInvite, getTeamInvite, listMyWorkspaces, listTeam, removeTeamMember,
  revokeTeamInvite, setTeamRole, type InviteSummary, type TeamMember, type WorkspaceSummary,
} from "@/lib/team.functions";
import { activeWorkspaceId, inviteUrl, setActiveWorkspace } from "@/lib/workspace-cookie";

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export function WorkspaceSwitcher() {
  const load = useServerFn(listMyWorkspaces);
  const [list, setList] = useState<WorkspaceSummary[]>([]);
  useEffect(() => { load().then(setList).catch(() => undefined); }, [load]);
  if (list.length < 2) return null;
  const current = list.find((w) => w.tenantId === activeWorkspaceId())?.tenantId ?? list[0]!.tenantId;
  return (
    <select
      aria-label="Switch restaurant"
      value={current}
      onChange={(e) => { setActiveWorkspace(e.target.value); window.location.href = "/dashboard"; }}
      className="mt-4 w-full truncate rounded-lg border border-border bg-background px-2 py-2 text-sm"
    >
      {list.map((w) => <option key={w.tenantId} value={w.tenantId}>{w.name}</option>)}
    </select>
  );
}

export function TeamPanel({ myId }: { myId: string }) {
  const fWs = useServerFn(listMyWorkspaces);
  const fTeam = useServerFn(listTeam);
  const fGet = useServerFn(getTeamInvite);
  const fMake = useServerFn(createTeamInvite);
  const fOff = useServerFn(revokeTeamInvite);
  const fRole = useServerFn(setTeamRole);
  const fRemove = useServerFn(removeTeamMember);
  const fNew = useServerFn(createAnotherWorkspace);

  const [list, setList] = useState<WorkspaceSummary[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invite, setInvite] = useState<InviteSummary>(null);
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const active = list.find((w) => w.tenantId === activeWorkspaceId()) ?? list[0];
  const isOwner = active?.role === "owner";

  const load = useCallback(async () => {
    try {
      const ws = await fWs();
      setList(ws);
      const cur = ws.find((w) => w.tenantId === activeWorkspaceId()) ?? ws[0];
      if (!cur) return;
      setTeam(await fTeam({ data: { tenantId: cur.tenantId } }));
      setInvite(cur.role === "owner" ? await fGet({ data: { tenantId: cur.tenantId } }) : null);
    } catch { setErr("Could not load the team. Refresh and try again."); }
  }, [fWs, fTeam, fGet]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok = "") {
    setBusy(true); setErr(""); setMsg("");
    try { await fn(); setMsg(ok); await load(); }
    catch (e) {
      let text = "Something went wrong. Try again.";
      if (e instanceof Response) { try { text = ((await e.json()) as { error?: string }).error ?? text; } catch { /* keep default */ } }
      setErr(text);
    }
    setBusy(false);
  }

  if (!active) return null;
  const tid = active.tenantId;
  return (
    <>
      <section className="glass-card mt-6 grid gap-4 rounded-2xl border border-border p-5">
        <h2 className="font-medium text-foreground">Team: {active.name}</h2>
        <p className="text-sm text-muted-foreground">
          You are <strong>{ROLE[active.role]}</strong> here. Everyone on the team sees the same restaurant data. Nobody outside it does.
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {team.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 break-all">{m.email}{m.userId === myId ? " (you)" : ""}</span>
              {isOwner ? (
                <span className="flex items-center gap-2">
                  <select aria-label={`Role for ${m.email}`} value={m.role} disabled={busy}
                    onChange={(e) => run(() => fRole({ data: { tenantId: tid, userId: m.userId, role: e.target.value as TeamMember["role"] } }))}
                    className="rounded border border-border bg-background px-2 py-1 text-xs">
                    <option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff</option>
                  </select>
                  {m.userId !== myId && (
                    <button disabled={busy} className="text-xs text-destructive underline" onClick={() => run(() => fRemove({ data: { tenantId: tid, userId: m.userId } }), "Member removed.")}>Remove</button>
                  )}
                </span>
              ) : <span className="text-xs text-muted-foreground">{ROLE[m.role]}</span>}
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="grid gap-2 text-sm">
            <p className="font-medium">Invite link</p>
            {invite ? (
              <>
                <Input readOnly value={inviteUrl(invite.token)} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
                <p className="text-xs text-muted-foreground">Joins as {ROLE[invite.role]}. Valid for 14 days. Anyone with the link can join, so share it with your team only.</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => navigator.clipboard?.writeText(inviteUrl(invite.token)).then(() => setMsg("Link copied."))}>Copy link</Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => fOff({ data: { tenantId: tid } }), "Link switched off.")}>Switch off</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Role for the invite link" value={role} onChange={(e) => setRole(e.target.value as "manager" | "staff")} className="rounded border border-border bg-background px-2 py-2 text-sm">
                  <option value="staff">Staff</option><option value="manager">Manager</option>
                </select>
                <Button type="button" disabled={busy} onClick={() => run(() => fMake({ data: { tenantId: tid, role } }), "Invite link created.")}>Create invite link</Button>
              </div>
            )}
          </div>
        )}
        {!isOwner && (
          <div><Button type="button" variant="outline" disabled={busy} onClick={() => run(async () => { await fRemove({ data: { tenantId: tid, userId: myId } }); window.location.href = "/dashboard"; })}>Leave this restaurant</Button></div>
        )}
        {msg && <p className="text-sm text-primary">{msg}</p>}
        {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      </section>

      <section className="glass-card mt-6 grid gap-3 rounded-2xl border border-border p-5">
        <h2 className="font-medium text-foreground">Your restaurants</h2>
        <ul className="text-sm">
          {list.map((w) => (
            <li key={w.tenantId} className="flex items-center justify-between py-1">
              <span>{w.name} <span className="text-xs text-muted-foreground">({ROLE[w.role]})</span></span>
              {w.tenantId === tid ? <span className="text-xs text-primary">Active</span> :
                <button className="text-xs underline" onClick={() => { setActiveWorkspace(w.tenantId); window.location.href = "/dashboard"; }}>Switch</button>}
            </li>
          ))}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return;
          run(async () => { const w = await fNew({ data: { name: name.trim() } }); setActiveWorkspace(w.tenantId); window.location.href = "/onboarding?step=profile"; }); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New restaurant name" className="min-w-0 flex-1" />
          <Button disabled={busy || !name.trim()}>Add restaurant</Button>
        </form>
      </section>
    </>
  );
}
