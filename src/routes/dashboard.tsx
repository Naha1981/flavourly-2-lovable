import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Home, Inbox, Megaphone, Settings, Sparkles } from "lucide-react";

import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const nav = [
  { to: "/dashboard", label: "Today", icon: Home, exact: true },
  { to: "/dashboard/inbox", label: "Inbox", icon: Inbox, exact: false },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone, exact: false },
  { to: "/dashboard/replies", label: "AI desk", icon: Sparkles, exact: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-card/60 p-5 lg:block">
        <Link to="/"><Logo /></Link>
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
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 lg:hidden">
          <Link to="/"><Logo /></Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="grid place-items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
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
