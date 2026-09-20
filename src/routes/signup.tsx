import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { AuthShell } from "@/routes/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
          setBusy(true);
          toast.info("Sign-up connects once your backend is plugged in.");
          setBusy(false);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="restaurant">Restaurant name</Label>
          <Input id="restaurant" placeholder="Marble" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" placeholder="Warren Dlamini" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@restaurant.co.za" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Choose a password</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" />
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
