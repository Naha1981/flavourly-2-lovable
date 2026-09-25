import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Flavourly" },
      {
        name: "description",
        content: "Sign in to your Flavourly workspace to see tonight's VIPs, reviews and bookings.",
      },
      { property: "og:title", content: "Sign in — Flavourly" },
      { property: "og:description", content: "Access your Flavourly restaurant workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Your tables have been busy while you were away."
      footer={
        <p className="text-sm text-muted-foreground">
          No account yet?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Start a free trial
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          toast.success("Welcome back.");
          navigate({ to: "/dashboard" });
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@restaurant.co.za" />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <span className="text-xs text-muted-foreground">Forgot it? Ask your owner</span>
          </div>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={busy} className="mt-2 w-full rounded-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-14">
        <Link to="/" className="mx-auto">
          <Logo size="md" />
        </Link>
        <div className="mt-8 rounded-2xl border border-border/70 bg-card p-7 shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center">{footer}</div>
      </div>
    </div>
  );
}
