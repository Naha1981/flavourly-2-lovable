import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { normalizeVoucherCode } from "./feedback";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export type RedeemResult =
  { ok: true; kind: "reward" | "recovery"; amountCents: number } | { ok: false; error: string };

/** Till check: mark a loyalty or recovery voucher as used, exactly once. Any staff role may do this. */
export const redeemVoucher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, code: z.string().trim().min(4).max(20) }).parse(d),
  )
  .handler(async ({ data }): Promise<RedeemResult> => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const code = normalizeVoucherCode(data.code);
    const now = new Date().toISOString();
    const used = (at: string) => ({
      ok: false as const,
      error: `That code was already used on ${new Date(at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}.`,
    });

    const { data: reward } = await c
      .from("reward_claims")
      .select("id, discount_cents, voucher_used_at")
      .eq("tenant_id", data.tenantId)
      .eq("status", "redeemed")
      .eq("voucher_code", code)
      .maybeSingle();
    if (reward) {
      if (reward.voucher_used_at) return used(reward.voucher_used_at as string);
      // The IS NULL guard makes a double-tap or two tills race safe: only one update matches.
      const { data: won } = await c
        .from("reward_claims")
        .update({ voucher_used_at: now })
        .eq("id", reward.id)
        .is("voucher_used_at", null)
        .select("id");
      return won?.length
        ? { ok: true, kind: "reward", amountCents: reward.discount_cents as number }
        : used(now);
    }

    const { data: rec } = await c
      .from("reputation_incidents")
      .select("id, recovery_voucher_cents, recovery_voucher_used_at")
      .eq("tenant_id", data.tenantId)
      .eq("recovery_voucher_code", code)
      .maybeSingle();
    if (rec) {
      if (rec.recovery_voucher_used_at) return used(rec.recovery_voucher_used_at as string);
      const { data: won } = await c
        .from("reputation_incidents")
        .update({ recovery_voucher_used_at: now, resolution_status: "resolved", resolved_at: now })
        .eq("id", rec.id)
        .is("recovery_voucher_used_at", null)
        .select("id");
      return won?.length
        ? { ok: true, kind: "recovery", amountCents: rec.recovery_voucher_cents as number }
        : used(now);
    }

    return {
      ok: false,
      error: "No voucher with that code for this restaurant. Check the code and try again.",
    };
  });
