import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/routes/login";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Flavourly" },
      { name: "description", content: "Set a new password for your Flavourly workspace." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (form: HTMLFormElement) => {
    setBusy(true);
    try {
      const password = String(new FormData(form).get("password") ?? "");
      if (password.length < 8) {
        toast.error("Use at least 8 characters.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated. You're signed in.");
      void navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="At least 8 characters."
      footer={<span />}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" />
        </div>
        <Button type="submit" disabled={busy} className="mt-2 w-full rounded-full">
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
