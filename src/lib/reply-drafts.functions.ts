import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildMenuFacts, generateReplyDraft, type MenuFactRow } from "./reply-drafts.server";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  intent: z.enum(["auto", "booking", "faq", "complaint"]),
  guestName: z.string().max(80).optional(),
  tenantId: z.string().max(80).optional(),
  policies: z.string().max(1500).optional(),
  restaurant: z.object({
    name: z.string().min(1).max(120),
    city: z.string().max(120).optional(),
    cuisine: z.string().max(120).optional(),
    hours: z.string().max(200).optional(),
    averageCheck: z.number().optional(),
    ownerName: z.string().max(80).optional(),
    notes: z.string().max(600).optional(),
  }),
});

export const draftReply = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { requireUser, authorizeTenant } = await import("./tenant-auth.server");
    await requireUser();
    let menuFacts: string | undefined;
    let menuItems = 0;
    if (data.tenantId) {
      await authorizeTenant(data.tenantId);
      const { db } = await import("./db.server");
      const { data: items } = await (await db())
        .from("menu_items")
        .select("name, description, price_cents, is_available, dietary_flags")
        .eq("tenant_id", data.tenantId)
        .limit(80);
      menuItems = items?.length ?? 0;
      menuFacts = buildMenuFacts((items ?? []) as MenuFactRow[]) || undefined;
    }
    const res = await generateReplyDraft({ ...data, menuFacts, policies: data.policies });
    return res.ok ? { ...res, menuItems } : res;
  });
