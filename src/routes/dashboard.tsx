import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Clock3,
  Home,
  Inbox,
  Megaphone,
  Mic,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { supabase } from "@/integrations/supabase/client";
import { isAuthRequired, signOut } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const nav = [
  { to: "/dashboard", label: "Today", icon: Home, exact: true },
  { to: "/dashboard/inbox", label: "Inbox", icon: Inbox, exact: false },
  { to: "/dashboard/voice", label: "Voice", icon: Mic, exact: false },
  { to: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, exact: false },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone, exact: false },
  { to: "/dashboard/intelligence/menu-matrix", label: "Profit", icon: BarChart3, exact: false },
  { to: "/dashboard/waitlist", label: "Waitlist", icon: Clock3, exact: false },
  { to: "/dashboard/redeem", label: "Redeem", icon: Ticket, exact: false },
  { to: "/dashboard/reputation", label: "Reputation", icon: ShieldAlert, exact: false },
  { to: "/dashboard/social", label: "Social", icon: Send, exact: false },
  { to: "/dashboard/replies", label: "AI desk", icon: Sparkles, exact: false },
  { to: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck, exact: false },
  { to: "/dashboard/whatsapp-health", label: "WA health", icon: Activity, exact: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

/** When login is enforced, send signed-out visitors to /login. Runs in the browser because the session lives there. */
function useAuthGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "open" | "authed">("checking");
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!(await isAuthRequired())) return alive && setState("open");
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) setState("authed");
      else navigate({ to: "/login", search: { redirect: window.location.pathname } });
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);
  return { state, navigate };
}

function DashboardLayout() {
  const { state, navigate } = useAuthGate();
  if (state === "checking") return null;
  const leave = async () => {
    await signOut();
    navigate({ to: "/login", search: {} });
  };
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card/60 p-5 lg:block">
        <Link to="/">
          <Logo />
        </Link>
        <nav className="mt-8 grid gap-1">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary font-medium text-foreground" }}
            >
              <Icon className="size-4" strokeWidth={1.6} /> {label}
            </Link>
          ))}
        </nav>
        {state === "authed" && (
          <button
            onClick={leave}
            className="mt-6 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Sign out
          </button>
        )}
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 lg:hidden">
          <Link to="/">
            <Logo />
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="grid min-w-[4.5rem] flex-1 place-items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}
          >
            <Icon className="size-5" strokeWidth={1.6} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export const dashMeta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — Flavourly` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — Flavourly` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
