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
import { captureTelemetry } from "@/lib/telemetry";
import { signupErrorMessage, validateSignup } from "@/lib/auth-rules";

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
          "Join the Flavourly Starter pilot. Seven days free, no card, up to 100 service replies after activation.",
      },
      { property: "og:title", content: "Start your free trial — Flavourly" },
      {
        property: "og:description",
        content: "One restaurant, one number. Activation follows connection and acceptance checks.",
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
      captureTelemetry("workflow_started", { workflow: "signup", source: "web" });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { restaurant, name: String(f.get("name") ?? "").trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        captureTelemetry("workflow_failed", {
          workflow: "signup",
          error_code: "signup_rejected",
          retryable: true,
        });
        toast.error(signupErrorMessage(error.code));
        return;
      }
      if (!data.session) {
        // Email confirmation is on: the workspace is created on first sign-in.
        captureTelemetry("workflow_completed", {
          workflow: "signup",
          status: "confirmation_required",
        });
        toast.success("Check your email to confirm your address, then sign in.");
        navigate({ to: "/login", search: {} });
        return;
      }
      const workspace = await enterWorkspace(restaurant);
      if (!workspace) throw new Error("Workspace creation did not complete");
      captureTelemetry("workflow_completed", { workflow: "signup", status: "active" });
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
      title="Start your 7-day trial"
      subtitle={
        plan
          ? `You asked about ${plan}. Starter pilot enrolment first; no card or automatic charge.`
          : "No card or automatic charge. Sending starts only after activation checks."
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
      <p className="mb-5 text-sm text-muted-foreground">
        One venue and one number. Trial: proposed allowance up to 100 replies, counted within
        Starter's 500 monthly replies; pilot cap 25 per day. Sending remains paused while these
        limits are verified. Replies only within 24 hours of an inbound customer message. Higher
        plans require a capacity check.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="restaurant">Restaurant name</Label>
          <Input id="restaurant" name="restaurant" placeholder="Your restaurant name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" placeholder="Your name" />
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
