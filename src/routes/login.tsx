import { signInWithCooldown } from "@/lib/login-cooldown";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { enterWorkspace } from "@/lib/auth-client";
import { postLoginPath, signInErrorMessage } from "@/lib/auth-rules";

const GOOGLE_REDIRECT_KEY = "fl_postlogin_redirect";

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
  const [loginWait, setLoginWait] = useState<string | null>(null);
  const loginAbort = useRef<AbortController | null>(null);
  useEffect(() => () => loginAbort.current?.abort(), []);
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  // Completes a full-page Google OAuth return: the browser lands back on the
  // app root without the ?redirect param, so the intended path is kept in
  // sessionStorage before the redirect starts.
  useEffect(() => {
    const stored = sessionStorage.getItem(GOOGLE_REDIRECT_KEY);
    if (stored === null) return;
    sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const ws = await enterWorkspace();
      if (!ws) return;
      navigate({ to: postLoginPath(stored) });
    })();
  }, [navigate]);

  const googleSignIn = async () => {
    setBusy(true);
    try {
      sessionStorage.setItem(GOOGLE_REDIRECT_KEY, redirect ?? "");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Couldn't start Google sign-in. Please try again.");
        return;
      }
      if (result.redirected) return; // Browser is heading to Google
      // Popup/inline flow: the session is already set.
      const ws = await enterWorkspace();
      if (!ws) {
        toast.error(
          "No restaurant is linked to this account yet. Start a free trial to create one.",
        );
        return;
      }
      toast.success("Welcome back.");
      navigate({ to: postLoginPath(redirect) });
    } catch {
      toast.error("Couldn't sign you in with Google. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (form: HTMLFormElement) => {
    if (busy) return;
    setBusy(true);
    setLoginWait(null);
    loginAbort.current?.abort();
    const controller = new AbortController();
    loginAbort.current = controller;
    try {
      const f = new FormData(form);
      const credentials = {
        email: String(f.get("email") ?? "").trim(),
        password: String(f.get("password") ?? ""),
      };
      const { error } = await signInWithCooldown(
        () => supabase.auth.signInWithPassword(credentials),
        {
          signal: controller.signal,
          onWait: (seconds) =>
            setLoginWait(
              `Sign-in is busy. Waiting ${seconds} seconds before one retry. Keep this page open.`,
            ),
        },
      );
      if (controller.signal.aborted) return;
      if (error) {
        toast.error(signInErrorMessage(error.message, error.code));
        return;
      }
      const ws = await enterWorkspace();
      if (!ws) {
        toast.error(
          "No restaurant is linked to this account yet. Start a free trial to create one.",
        );
        return;
      }
      toast.success("Welcome back.");
      navigate({ to: postLoginPath(redirect) });
    } catch {
      if (!controller.signal.aborted) toast.error("Couldn't sign you in. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        setLoginWait(null);
      }
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to return to your restaurant and saved work."
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
          void submit(event.currentTarget);
        }}
        className="grid gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.co.za"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-forest hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>
        {loginWait && (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {loginWait}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-2 w-full rounded-full">
          Sign in
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void googleSignIn()}
        className="w-full rounded-full"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
          <path
            fill="#EA4335"
            d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.62.75 3.84 3.27 2.04 6.94l3.66 2.84C6.55 7.03 9.02 5.04 12 5.04z"
          />
          <path
            fill="#4285F4"
            d="M23.25 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.68 2.85c2.15-1.99 3.5-4.92 3.5-8.67z"
          />
          <path
            fill="#FBBC05"
            d="M5.7 14.22a7.06 7.06 0 0 1 0-4.44L2.04 6.94a11.26 11.26 0 0 0 0 10.12l3.66-2.84z"
          />
          <path
            fill="#34A853"
            d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.68-2.85c-1.02.69-2.33 1.1-3.78 1.1-2.98 0-5.45-1.99-6.3-4.66l-3.66 2.84c1.8 3.67 5.58 6.29 9.96 6.29z"
          />
        </svg>
        Sign in with Google
      </Button>
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
