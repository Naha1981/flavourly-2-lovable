import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const tier = z.enum(["starter", "casual", "premium", "signature", "group"]);

const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("../tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export const getBilling = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { getBillingStatus } = await import("./billing.server");
    return getBillingStatus(data.tenantId);
  });

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, tier }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { createCheckout } = await import("./billing.server");
    return createCheckout(data.tenantId, data.tier);
  });

export const cancelPlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { cancelSubscription } = await import("./billing.server");
    await cancelSubscription(data.tenantId);
    return { ok: true as const };
  });
