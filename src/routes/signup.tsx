import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { AuthShell } from "@/routes/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { enterWorkspace } from "@/lib/auth-client";
import { validateSignup } from "@/lib/auth-rules";

const searchSchema = z.object({
  plan: z.string().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Start your free trial — Flavourly" },
      {
        name: "description",
        content:
          "Create your Flavourly workspace in two minutes. Fourteen days free, no card, cancel any time.",
      },
      { property: "og:title", content: "Start your free trial — Flavourly" },
      {
        property: "og:description",
        content: "Set up your restaurant's AI revenue employee in two minutes.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { plan } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (form: HTMLFormElement) => {
    setBusy(true);
    try {
      const f = new FormData(form);
      const restaurant = String(f.get("restaurant") ?? "").trim();
      const email = String(f.get("email") ?? "").trim();
      const password = String(f.get("password") ?? "");
      const invalid = validateSignup({ restaurant, email, password });
      if (invalid) {
        toast.error(invalid);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { restaurant, name: String(f.get("name") ?? "").trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        // Email confirmation is on: the workspace is created on first sign-in.
        toast.success("Check your email to confirm your address, then sign in.");
        navigate({ to: "/login", search: {} });
        return;
      }
      await enterWorkspace(restaurant);
      toast.success("Workspace created — let's set up your restaurant.");
      navigate({ to: "/onboarding", search: { step: "profile" } });
    } catch {
      toast.error("Couldn't create your workspace. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Start your 14-day trial"
      subtitle={
        plan
          ? `You picked the ${plan} plan. No card needed to begin.`
          : "No card needed. Your AI host answers from day one."
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Already with us?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="restaurant">Restaurant name</Label>
          <Input id="restaurant" name="restaurant" placeholder="Marble" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" placeholder="Warren Dlamini" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.co.za"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Choose a password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" disabled={busy} className="mt-2 w-full rounded-full">
          Create my workspace
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="underline">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/legal/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
