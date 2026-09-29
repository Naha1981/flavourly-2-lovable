import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { redeemVoucher, type RedeemResult } from "@/lib/vouchers.functions";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/redeem")({
  head: () => dashMeta("Redeem a code", "Check a guest's voucher code and take it off the bill."),
  component: RedeemPage,
});

function RedeemPage() {
  const { profile, ready } = useRestaurantProfile();
  const redeem = useServerFn(redeemVoucher);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  if (!ready) return null;

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await redeem({ data: { tenantId: profile.slug, code } }));
      setCode("");
    } catch {
      setResult({
        ok: false,
        error: "Couldn't check that code. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Redeem a code"
        sub="Type the code the guest shows you. Each code works once."
      />
      <form
        className="glass-card grid max-w-md gap-4 rounded-2xl border border-border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="voucher-code">Voucher code</Label>
          <Input
            id="voucher-code"
            autoComplete="off"
            autoCapitalize="characters"
            className="font-mono text-lg uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || code.trim().length < 4}>
          {busy ? "Checking…" : "Check and redeem"}
        </Button>
        {result && (
          <p
            role="status"
            className={`rounded-xl p-3 text-sm ${result.ok ? "bg-forest-soft text-forest" : "bg-secondary text-foreground"}`}
          >
            {result.ok
              ? `Valid. Take ${formatZAR(result.amountCents)} off the bill (${result.kind === "reward" ? "loyalty reward" : "service recovery voucher"}).`
              : result.error}
          </p>
        )}
      </form>
    </>
  );
}
