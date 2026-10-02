import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80);
const strList = z.array(z.string().max(60)).max(8);

export const preferencesSchema = z.object({
  dietary: strList,
  allergies: strList,
  seating: strList,
  occasions: strList,
  favourites: strList,
  drinks: strList,
  spend: z.enum(["unknown", "budget", "mid", "premium"]),
  tags: strList,
  notes: z.string().max(400),
});

export const extractGuestPreferences = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        conversation: z.string().trim().min(10).max(12000),
        guestName: z.string().max(80).optional(),
        restaurantName: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { extractPreferences } = await import("./guest-preferences.server");
    return extractPreferences(data);
  });

export const saveGuestPreferences = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, conversationId: z.string().uuid(), preferences: preferencesSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { db } = await import("./db.server");
    const { error } = await (await db())
      .from("wa_conversations")
      .update({ preferences: { ...data.preferences, updatedAt: new Date().toISOString() } })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.conversationId);
    if (error) {
      console.error("saveGuestPreferences", error);
      return { ok: false, error: "Couldn't save to the guest profile." };
    }
    return { ok: true };
  });
