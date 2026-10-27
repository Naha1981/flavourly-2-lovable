import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { classifyMenu, type MatrixSummary } from "./menu-matrix";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const cents = z.number().int().min(0).max(100_000_00);
const dietary = z
  .array(z.enum(["vegan", "vegetarian", "halaal", "gluten_free", "dairy_free", "nut_free"]))
  .max(6);

export type MenuItemRow = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  costPriceCents: number | null;
  isAvailable: boolean;
  dietaryFlags: string[];
  salesCount30d: number;
};
export type MenuCategoryRow = { id: string; name: string; sortOrder: number };
export type PairingRow = {
  id: string;
  sourceItemId: string;
  pairedItemId: string;
  pairingType: string;
  pitchCopy: string | null;
  isActive: boolean;
};
export type VenueRow = {
  tenantId: string;
  name: string;
  whatsappPhone: string | null;
  managerPhone: string | null;
  googleReviewUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  autoRepliesEnabled: boolean;
};

const guard = async (tenantId: string, roles: "any" | "managers" = "any") => {
  const { authorizeTenant, ANY_ROLE, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, roles === "any" ? ANY_ROLE : MANAGERS);
};

const fail = (msg: string) => ({ ok: false as const, error: msg });

/* ---------- public menu (guest-facing; never exposes cost or internal fields) ---------- */

export type PublicMenu = {
  venue: { name: string; slug: string; whatsappPhone: string | null };
  categories: Array<{
    id: string;
    name: string;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      priceCents: number;
      isAvailable: boolean;
      dietaryFlags: string[];
      pairings: Array<{ id: string; name: string; priceCents: number; pitch: string | null }>;
    }>;
  }>;
};

export const getPublicMenu = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ slug: tenant }).parse(d))
  .handler(async ({ data }): Promise<PublicMenu | null> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data: venue } = await c
      .from("tenant_profiles")
      .select("name, whatsapp_phone")
      .eq("tenant_id", data.slug)
      .maybeSingle();
    if (!venue) return null;

    const [{ data: cats }, { data: items }, { data: pairs }] = await Promise.all([
      c
        .from("menu_categories")
        .select("id, name, sort_order")
        .eq("tenant_id", data.slug)
        .eq("is_active", true)
        .order("sort_order"),
      c
        .from("menu_items")
        .select("id, category_id, name, description, price_cents, is_available, dietary_flags")
        .eq("tenant_id", data.slug)
        .order("name"),
      c
        .from("menu_item_pairings")
        .select("id, source_item_id, paired_item_id, pitch_copy")
        .eq("tenant_id", data.slug)
        .eq("is_active", true),
    ]);

    const byId = new Map((items ?? []).map((i) => [i.id as string, i]));
    const pairingsFor = (id: string) =>
      (pairs ?? [])
        .filter((p) => p.source_item_id === id)
        .flatMap((p) => {
          const target = byId.get(p.paired_item_id as string);
          // Never recommend something that is 86'd.
          if (!target || !target.is_available) return [];
          return [
            {
              id: p.id as string,
              name: target.name as string,
              priceCents: target.price_cents as number,
              pitch: (p.pitch_copy as string | null) ?? null,
            },
          ];
        });

    const shape = (i: NonNullable<typeof items>[number]) => ({
      id: i.id as string,
      name: i.name as string,
      description: (i.description as string | null) ?? null,
      priceCents: i.price_cents as number,
      isAvailable: i.is_available as boolean,
      dietaryFlags: (i.dietary_flags as string[]) ?? [],
      pairings: pairingsFor(i.id as string),
    });

    const categories = (cats ?? []).map((cat) => ({
      id: cat.id as string,
      name: cat.name as string,
      items: (items ?? []).filter((i) => i.category_id === cat.id).map(shape),
    }));
    const uncategorised = (items ?? []).filter(
      (i) => !i.category_id || !cats?.some((cat) => cat.id === i.category_id),
    );
    if (uncategorised.length)
      categories.push({ id: "other", name: "Menu", items: uncategorised.map(shape) });

    return {
      venue: {
        name: venue.name as string,
        slug: data.slug,
        whatsappPhone: (venue.whatsapp_phone as string | null) ?? null,
      },
      categories: categories.filter((cat) => cat.items.length > 0),
    };
  });

/* ---------- dashboard ---------- */

export const listMenuAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(
    async ({
      data,
    }): Promise<{
      categories: MenuCategoryRow[];
      items: MenuItemRow[];
      pairings: PairingRow[];
    }> => {
      const { authorizeTenant } = await import("./tenant-auth.server");
      await authorizeTenant(data.tenantId);
      const { db } = await import("./db.server");
      const c = await db();
      const [cats, items, pairs] = await Promise.all([
        c
          .from("menu_categories")
          .select("id, name, sort_order")
          .eq("tenant_id", data.tenantId)
          .order("sort_order"),
        c.from("menu_items").select("*").eq("tenant_id", data.tenantId).order("name"),
        c.from("menu_item_pairings").select("*").eq("tenant_id", data.tenantId),
      ]);
      return {
        categories: (cats.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          sortOrder: r.sort_order,
        })),
        items: (items.data ?? []).map((r) => ({
          id: r.id,
          categoryId: r.category_id,
          name: r.name,
          description: r.description,
          priceCents: r.price_cents,
          costPriceCents: r.cost_price_cents,
          isAvailable: r.is_available,
          dietaryFlags: r.dietary_flags ?? [],
          salesCount30d: r.sales_count_30d,
        })),
        pairings: (pairs.data ?? []).map((r) => ({
          id: r.id,
          sourceItemId: r.source_item_id,
          pairedItemId: r.paired_item_id,
          pairingType: r.pairing_type,
          pitchCopy: r.pitch_copy,
          isActive: r.is_active,
        })),
      };
    },
  );

export const saveCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        name: z.string().trim().min(1).max(60),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    await guard(data.tenantId, "any");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c
      .from("menu_categories")
      .insert({ tenant_id: data.tenantId, name: data.name, sort_order: data.sortOrder });
    return error ? fail("Couldn't add that section.") : { ok: true as const };
  });

export const saveMenuItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        id: z.string().uuid().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(400).nullable().optional(),
        priceCents: cents,
        costPriceCents: cents.nullable().optional(),
        dietaryFlags: dietary.default([]),
        salesCount30d: z.number().int().min(0).max(1_000_000).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    const row = {
      tenant_id: data.tenantId,
      category_id: data.categoryId ?? null,
      name: data.name,
      description: data.description ?? null,
      price_cents: data.priceCents,
      cost_price_cents: data.costPriceCents ?? null,
      dietary_flags: data.dietaryFlags,
      sales_count_30d: data.salesCount30d,
    };
    const q = data.id
      ? c.from("menu_items").update(row).eq("tenant_id", data.tenantId).eq("id", data.id)
      : c.from("menu_items").insert(row);
    const { error } = await q;
    return error ? fail("Couldn't save that dish.") : { ok: true as const };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, itemId: z.string().uuid(), isAvailable: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "any");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c
      .from("menu_items")
      .update({ is_available: data.isAvailable })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.itemId);
    return error ? fail("Couldn't update availability.") : { ok: true as const };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, itemId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c
      .from("menu_items")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("id", data.itemId);
    return error ? fail("Couldn't remove that dish.") : { ok: true as const };
  });

export const savePairing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        sourceItemId: z.string().uuid(),
        pairedItemId: z.string().uuid(),
        pairingType: z.enum(["upsell", "cross_sell", "beverage_pairing", "dessert_pairing"]),
        pitchCopy: z.string().trim().max(160).nullable().optional(),
      })
      .refine((v) => v.sourceItemId !== v.pairedItemId, "A dish can't pair with itself")
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    // Both items must belong to this tenant.
    const { data: owned } = await c
      .from("menu_items")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .in("id", [data.sourceItemId, data.pairedItemId]);
    if ((owned?.length ?? 0) !== 2) return fail("Those dishes don't belong to this restaurant.");
    const { error } = await c.from("menu_item_pairings").upsert(
      {
        tenant_id: data.tenantId,
        source_item_id: data.sourceItemId,
        paired_item_id: data.pairedItemId,
        pairing_type: data.pairingType,
        pitch_copy: data.pitchCopy ?? null,
        is_active: true,
      },
      { onConflict: "source_item_id,paired_item_id" },
    );
    return error ? fail("Couldn't save that pairing.") : { ok: true as const };
  });

export const deletePairing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, pairingId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c
      .from("menu_item_pairings")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("id", data.pairingId);
    return error ? fail("Couldn't remove that pairing.") : { ok: true as const };
  });

export const getMenuMatrix = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<MatrixSummary> => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("menu_items")
      .select("id, name, price_cents, cost_price_cents, sales_count_30d, is_available")
      .eq("tenant_id", data.tenantId);
    return classifyMenu(
      (rows ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        priceCents: r.price_cents,
        costPriceCents: r.cost_price_cents,
        salesCount30d: r.sales_count_30d,
        isAvailable: r.is_available,
      })),
    );
  });

/* ---------- venue profile ---------- */

export const getVenue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<VenueRow | null> => {
    await guard(data.tenantId, "any");
    const { db } = await import("./db.server");
    const c = await db();
    const { data: r } = await c
      .from("tenant_profiles")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (!r) return null;
    return {
      tenantId: r.tenant_id,
      name: r.name,
      whatsappPhone: r.whatsapp_phone,
      managerPhone: r.manager_phone,
      googleReviewUrl: r.google_review_url,
      latitude: r.latitude === null ? null : Number(r.latitude),
      longitude: r.longitude === null ? null : Number(r.longitude),
      geofenceRadiusM: r.geofence_radius_m,
      autoRepliesEnabled: r.auto_replies_enabled,
    };
  });

export const saveVenue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        name: z.string().trim().min(1).max(120),
        whatsappPhone: z
          .string()
          .regex(/^\+?\d{9,15}$/)
          .nullable()
          .optional(),
        managerPhone: z
          .string()
          .regex(/^\+?\d{9,15}$/)
          .nullable()
          .optional(),
        googleReviewUrl: z.string().url().max(300).nullable().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        geofenceRadiusM: z.number().int().min(50).max(5000).default(500),
        autoRepliesEnabled: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "managers");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c.from("tenant_profiles").upsert(
      {
        tenant_id: data.tenantId,
        name: data.name,
        whatsapp_phone: data.whatsappPhone?.replace(/\D/g, "") ?? null,
        manager_phone: data.managerPhone?.replace(/\D/g, "") ?? null,
        google_review_url: data.googleReviewUrl ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        geofence_radius_m: data.geofenceRadiusM,
        auto_replies_enabled: data.autoRepliesEnabled,
      },
      { onConflict: "tenant_id" },
    );
    return error ? fail("Couldn't save venue settings.") : { ok: true as const };
  });

/* ---------- loyalty (guest claim link) ---------- */

export const getClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) }).parse(d))
  .handler(async ({ data }) => {
    // Public endpoint: 30 previews/min per source IP (token entropy is the
    // real wall; this blunts scraping and probing - see rate-limit.server.ts).
    const { allowRateLimited, rateLimitedResponse } = await import("./rate-limit.server");
    if (!allowRateLimited("claim-preview", 30, 60_000)) throw rateLimitedResponse();
    const { getClaimPreview } = await import("./loyalty.server");
    return getClaimPreview(data.token);
  });

export const redeemClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().regex(/^[a-f0-9]{32}$/),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    // Public endpoint burning loyalty points: 10 redeems/min per source IP.
    const { allowRateLimited, rateLimitedResponse } = await import("./rate-limit.server");
    if (!allowRateLimited("claim-redeem", 10, 60_000)) throw rateLimitedResponse();
    const { redeemAtVenue } = await import("./loyalty.server");
    return redeemAtVenue(data.token, data.lat, data.lon);
  });
