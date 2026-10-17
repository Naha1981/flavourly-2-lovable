import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/routes/login";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Flavourly" },
      { name: "description", content: "Get a password reset link for your Flavourly workspace." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (form: HTMLFormElement) => {
    setBusy(true);
    try {
      const email = String(new FormData(form).get("email") ?? "").trim();
      if (!email) {
        toast.error("Enter your email address first.");
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a reset link."
      footer={
        <p className="text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-forest hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          If that email belongs to a Flavourly account, a reset link is on its way. Open it on this
          device to choose a new password.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(event.currentTarget);
          }}
          className="grid gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@restaurant.co.za" />
          </div>
          <Button type="submit" disabled={busy} className="mt-2 w-full rounded-full">
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
