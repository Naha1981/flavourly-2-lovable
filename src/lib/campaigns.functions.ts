import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const segment = z.enum(["all", "vip", "dormant_30", "dormant_60"]);
const message = z.string().trim().min(1).max(1000);

const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export { type CampaignSummary } from "./campaigns.server";

export const listCampaigns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { listCampaignsWithAttribution } = await import("./campaigns.server");
    return listCampaignsWithAttribution(data.tenantId);
  });

export const getAudienceSize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, segment }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { audienceSize } = await import("./campaigns.server");
    return audienceSize(data.tenantId, data.segment);
  });

export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        name: z.string().trim().min(1).max(100),
        segment,
        messageA: message,
        messageB: message.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c.from("campaigns").insert({
      tenant_id: data.tenantId,
      name: data.name,
      segment: data.segment,
      message_a: data.messageA,
      message_b: data.messageB ?? null,
    });
    return error
      ? { ok: false as const, error: "Couldn't save that campaign." }
      : { ok: true as const };
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, campaignId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { launchCampaign } = await import("./campaigns.server");
    return launchCampaign(data.tenantId, data.campaignId);
  });
