import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const tenant = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const guard = async (id: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(id, MANAGERS);
};
export const reviewStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const venue = await c
      .from("tenant_profiles")
      .select("review_requests_enabled")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    const rows = await c
      .from("review_followups")
      .select("id,step,state,due_at,error,clicked_at")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(30);
    return {
      enabled:
        process.env["REVIEW_AUTOMATION_ENABLED"] === "true" &&
        venue.data?.review_requests_enabled === true,
      available: !venue.error && !rows.error,
      rows: rows.data ?? [],
    };
  });
export const recordPaidVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        phone: z.string().regex(/^\+?[0-9]{9,15}$/),
        spendCents: z.number().int().min(1).max(100000000),
        billRef: z.string().trim().min(1).max(100),
        reviewConsent: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { upsertCustomer, recordVisit } = await import("./loyalty.server");
    const customer = await upsertCustomer(data.tenantId, data.phone);
    const { db } = await import("./db.server");
    const c = await db();
    // An unchecked box revokes future review consent. Historical rows are not restarted.
    const result = await c
      .from("customers")
      .update({ review_consent_at: data.reviewConsent ? new Date().toISOString() : null })
      .eq("tenant_id", data.tenantId)
      .eq("id", customer.id);
    if (result.error) throw result.error;
    if (!data.reviewConsent) {
      const cancelled = await c
        .from("review_followups")
        .update({ state: "cancelled", error: "Review consent withdrawn" })
        .eq("tenant_id", data.tenantId)
        .eq("customer_id", customer.id)
        .in("state", ["scheduled", "held"]);
      if (cancelled.error) throw cancelled.error;
    }
    return recordVisit(data.tenantId, data.phone, data.spendCents, data.billRef);
  });
