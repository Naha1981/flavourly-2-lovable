import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { RECOVERY_DEFAULT_CENTS, RECOVERY_MAX_CENTS } from "./feedback";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const STATUSES = ["open", "investigating", "voucher_sent", "resolved", "ignored"] as const;

const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export type Incident = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  rating: number;
  feedbackText: string | null;
  status: (typeof STATUSES)[number];
  assignedTo: string | null;
  voucherCode: string | null;
  voucherCents: number | null;
  createdAt: string;
};

export const listIncidents = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<Incident[]> => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("reputation_incidents")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (rows ?? []).map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      rating: r.rating,
      feedbackText: r.feedback_text,
      status: r.resolution_status,
      assignedTo: r.assigned_to,
      voucherCode: r.recovery_voucher_code,
      voucherCents: r.recovery_voucher_cents,
      createdAt: r.created_at,
    }));
  });

export const updateIncident = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        incidentId: z.string().uuid(),
        status: z.enum(STATUSES).optional(),
        assignedTo: z.string().trim().max(80).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch["resolution_status"] = data.status;
      patch["resolved_at"] =
        data.status === "resolved" || data.status === "ignored" ? new Date().toISOString() : null;
    }
    if (data.assignedTo !== undefined) patch["assigned_to"] = data.assignedTo;
    const { error } = await c
      .from("reputation_incidents")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.incidentId);
    return error
      ? { ok: false as const, error: "Couldn't update that incident." }
      : { ok: true as const };
  });

/** One click: personal apology plus a single-use recovery code, sent to the guest now. */
export const sendRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        incidentId: z.string().uuid(),
        amountCents: z
          .number()
          .int()
          .min(1000)
          .max(RECOVERY_MAX_CENTS)
          .default(RECOVERY_DEFAULT_CENTS),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const { enqueueOutbox } = await import("./outbox.server");
    const { newVoucherCode } = await import("./feedback");
    const { formatZAR } = await import("./south-africa");
    const c = await db();

    const { data: inc } = await c
      .from("reputation_incidents")
      .select("id, customer_name, customer_phone, recovery_voucher_code")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.incidentId)
      .maybeSingle();
    if (!inc) return { ok: false as const, error: "Incident not found." };
    if (inc.recovery_voucher_code)
      return { ok: false as const, error: "A voucher was already sent for this incident." };

    const { data: venue } = await c
      .from("tenant_profiles")
      .select("name")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    const code = newVoucherCode();
    const first = ((inc.customer_name as string | null) ?? "").split(" ")[0] || "there";
    const text =
      `Hi ${first}, this is the team at ${venue?.name ?? "the restaurant"}. We're truly sorry about your experience.` +
      (data.note ? ` ${data.note}` : "") +
      `\n\nPlease accept ${formatZAR(data.amountCents)} off your next visit. Show this code to your server: *${code}*`;

    // A person chose to send this to a guest who wrote to us: not automated marketing.
    await enqueueOutbox({
      tenantId: data.tenantId,
      phone: inc.customer_phone as string,
      text,
      automated: false,
      dedupeKey: `recovery:${inc.id}`,
    });
    const { error } = await c
      .from("reputation_incidents")
      .update({
        resolution_status: "voucher_sent",
        recovery_voucher_code: code,
        recovery_voucher_cents: data.amountCents,
      })
      .eq("id", inc.id)
      .is("recovery_voucher_code", null);
    return error
      ? { ok: false as const, error: "Sent, but couldn't record the voucher." }
      : { ok: true as const, code };
  });
