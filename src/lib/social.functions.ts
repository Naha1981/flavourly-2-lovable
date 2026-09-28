import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { formatZAR } from "./south-africa";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export type SocialDraft = {
  id: string;
  caption: string;
  mediaUrls: string[];
  targetPlatforms: string[];
  status: string;
  error: string | null;
  createdAt: string;
};

export const listSocialDrafts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<SocialDraft[]> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("social_content_drafts")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id,
      caption: r.caption,
      mediaUrls: r.media_urls ?? [],
      targetPlatforms: r.target_platforms ?? [],
      status: r.status,
      error: r.error,
      createdAt: r.created_at,
    }));
  });

/** Drafts from real data: the best-selling dishes that are in stock right now. No AI, so no invented dishes or prices. */
export const generateSocialDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, theme: z.string().trim().max(80).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, APP_URL } = await import("./db.server");
    const c = await db();
    const { data: venue } = await c
      .from("tenant_profiles")
      .select("name")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (!venue) return { ok: false as const, error: "Set up your venue details first." };

    const { data: top } = await c
      .from("menu_items")
      .select("name, price_cents")
      .eq("tenant_id", data.tenantId)
      .eq("is_available", true)
      .order("sales_count_30d", { ascending: false })
      .limit(3);
    if (!top?.length) return { ok: false as const, error: "Add some menu items first." };

    const dishes = top.map((d) => `${d.name} (${formatZAR(d.price_cents as number)})`).join(" · ");
    const link = APP_URL() ? `\n\nMenu & bookings: ${APP_URL()}/m/${data.tenantId}` : "";
    const lead = data.theme ? `${data.theme} at ${venue.name}.` : `This week at ${venue.name}.`;
    const caption = `${lead}\n\nGuest favourites right now: ${dishes}.${link}`;

    const { error } = await c.from("social_content_drafts").insert({
      tenant_id: data.tenantId,
      caption,
      status: "pending_approval",
    });
    return error
      ? { ok: false as const, error: "Couldn't create the draft." }
      : { ok: true as const };
  });

export const rejectSocialDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, draftId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c
      .from("social_content_drafts")
      .update({ status: "rejected" })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.draftId)
      .in("status", ["drafted", "pending_approval"]);
    return error
      ? { ok: false as const, error: "Couldn't reject that draft." }
      : { ok: true as const };
  });

export const approveSocialDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        draftId: z.string().uuid(),
        caption: z.string().trim().min(1).max(2200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { publishDraft } = await import("./openpost.server");
    return publishDraft(data.tenantId, data.draftId, data.caption);
  });
