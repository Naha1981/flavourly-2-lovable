import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export type CompetitorRecord = {
  id: string;
  name: string;
  address: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number;
  priceBand: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
};

export type MarketOpportunity = {
  id: string;
  title: string;
  description: string;
  opportunityType: string;
  confidence: number | null;
  status: string;
  createdAt: string;
};

export const listMarket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const c = await import("./db.server").then((m) => m.db());
    const [{ data: competitors, error: competitorError }, { data: opportunities, error: opportunityError }] =
      await Promise.all([
        c.from("competitors").select("id,name,address,website_url,rating,review_count,price_band,is_active,last_checked_at")
          .eq("tenant_id", data.tenantId).eq("is_active", true).order("name"),
        c.from("market_opportunities").select("id,title,description,opportunity_type,confidence,status,created_at")
          .eq("tenant_id", data.tenantId).eq("status", "open").order("created_at", { ascending: false }).limit(50),
      ]);
    if (competitorError) throw new Error(competitorError.message);
    if (opportunityError) throw new Error(opportunityError.message);
    return {
      competitors: (competitors ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        websiteUrl: row.website_url,
        rating: row.rating,
        reviewCount: row.review_count,
        priceBand: row.price_band,
        isActive: row.is_active,
        lastCheckedAt: row.last_checked_at,
      })) as CompetitorRecord[],
      opportunities: (opportunities ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        opportunityType: row.opportunity_type,
        confidence: row.confidence,
        status: row.status,
        createdAt: row.created_at,
      })) as MarketOpportunity[],
    };
  });

export const addCompetitor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    tenantId: tenant,
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().max(300).nullable().optional(),
    websiteUrl: z.string().url().max(500).nullable().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const c = await import("./db.server").then((m) => m.db());
    const { error } = await c.from("competitors").upsert({
      tenant_id: data.tenantId,
      name: data.name,
      address: data.address ?? null,
      website_url: data.websiteUrl ?? null,
      is_active: true,
    }, { onConflict: "tenant_id,name" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    tenantId: tenant,
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(2000),
    opportunityType: z.enum(["price","menu","rating","promotion","demand","coverage","other"]),
    confidence: z.number().min(0).max(1).nullable().optional(),
    evidence: z.record(z.string(), z.unknown()).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const c = await import("./db.server").then((m) => m.db());
    const { error } = await c.from("market_opportunities").insert({
      tenant_id: data.tenantId,
      title: data.title,
      description: data.description,
      opportunity_type: data.opportunityType,
      confidence: data.confidence ?? null,
      evidence: data.evidence ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resolveOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, opportunityId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const c = await import("./db.server").then((m) => m.db());
    const { error } = await c.from("market_opportunities").update({
      status: "addressed",
      addressed_at: new Date().toISOString(),
    }).eq("tenant_id", data.tenantId).eq("id", data.opportunityId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
