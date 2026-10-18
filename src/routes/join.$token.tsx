import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { acceptTeamInvite, getInviteInfo } from "@/lib/team.functions";
import { setActiveWorkspace } from "@/lib/workspace-cookie";

export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ title: "Join a restaurant — Flavourly" }] }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const fInfo = useServerFn(getInviteInfo);
  const fAccept = useServerFn(acceptTeamInvite);
  const [info, setInfo] = useState<{ name: string; role: string } | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    fInfo({ data: { token } }).then(setInfo).catch(() => setInfo(null));
  }, [token, fInfo]);

  async function join() {
    setBusy(true); setErr("");
    try {
      const ws = await fAccept({ data: { token } });
      setActiveWorkspace(ws.tenantId);
      await navigate({ to: "/dashboard" });
    } catch (e) {
      let t = "Could not join. Try again.";
      if (e instanceof Response) { try { t = ((await e.json()) as { error?: string }).error ?? t; } catch { /* default */ } }
      setErr(t); setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/"><Logo /></Link>
        <h1 className="mt-8 font-display text-3xl">Join a restaurant</h1>
        <div className="glass-card mt-6 grid gap-4 rounded-2xl border border-border p-5">
          {info === undefined || signedIn === null ? <p className="text-sm text-muted-foreground">Checking the invite…</p> :
           info === null ? <p className="text-sm">This invite link is no longer valid. Ask the restaurant owner for a new one.</p> : (
            <>
              <p className="text-sm text-muted-foreground">You have been invited to <strong>{info.name}</strong> as {info.role}.</p>
              {signedIn ? (
                <Button disabled={busy} onClick={join}>{busy ? "Joining…" : "Join restaurant"}</Button>
              ) : (
                <div className="grid gap-2">
                  <Button asChild><Link to="/signup" search={{ join: token }}>Create an account to join</Link></Button>
                  <Button asChild variant="outline"><Link to="/login" search={{ redirect: `/join/${token}` }}>I already have an account</Link></Button>
                </div>
              )}
            </>
          )}
          {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}
