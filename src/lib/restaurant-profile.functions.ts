import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeTenant } from "./tenant-auth.server";
import { db } from "./db.server";

const tenantIdSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

const profilePatch = z.object({
  tenantId: tenantIdSchema,
  name: z.string().trim().min(1).max(120).optional(),
  ownerName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  cuisine: z.string().trim().max(120).optional(),
  hours: z.string().trim().max(500).optional(),
  averageCheck: z.number().finite().min(0).max(1000000).optional(),
  notes: z.string().max(5000).optional(),
  managerPhone: z.string().trim().max(30).optional(),
  waAccountId: z.string().trim().max(120).nullable().optional(),
});

export type RestaurantProfileRecord = {
  tenantId: string;
  name: string;
  ownerName: string;
  city: string;
  cuisine: string;
  hours: string;
  averageCheck: number;
  notes: string;
  managerPhone: string;
  waAccountId: string | null;
};

function toProfile(row: Record<string, unknown>, tenantId: string): RestaurantProfileRecord {
  return {
    tenantId,
    name: String(row["name"] ?? tenantId),
    ownerName: String(row["owner_name"] ?? ""),
    city: String(row["city"] ?? ""),
    cuisine: String(row["cuisine"] ?? ""),
    hours: String(row["hours"] ?? ""),
    averageCheck: Number(row["average_check_cents"] ?? 0) / 100,
    notes: String(row["notes"] ?? ""),
    managerPhone: String(row["manager_phone"] ?? ""),
    waAccountId: row["wa_account_id"] ? String(row["wa_account_id"]) : null,
  };
}

async function firstTenantForUser(userId: string): Promise<string | null> {
  const c = await db();
  const { data } = await c
    .from("tenant_members")
    .select("tenant_id, created_at")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1);
  return data?.[0]?.tenant_id ? String(data[0]["tenant_id"]) : null;
}

export const getRestaurantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RestaurantProfileRecord | null> => {
    const tenantId = await firstTenantForUser(context.userId);
    if (!tenantId) return null;

    await authorizeTenant(tenantId);
    const c = await db();
    const { data } = await c
      .from("tenant_profiles")
      .select("tenant_id, name, owner_name, city, cuisine, hours, average_check_cents, notes, manager_phone, wa_account_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return data ? toProfile(data as Record<string, unknown>, tenantId) : null;
  });

export const updateRestaurantProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profilePatch.parse(d))
  .handler(async ({ data }): Promise<RestaurantProfileRecord> => {
    await authorizeTenant(data.tenantId);
    const c = await db();
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.ownerName !== undefined) patch["owner_name"] = data.ownerName;
    if (data.city !== undefined) patch["city"] = data.city;
    if (data.cuisine !== undefined) patch["cuisine"] = data.cuisine;
    if (data.hours !== undefined) patch["hours"] = data.hours;
    if (data.averageCheck !== undefined) patch["average_check_cents"] = Math.round(data.averageCheck * 100);
    if (data.notes !== undefined) patch["notes"] = data.notes;
    if (data.managerPhone !== undefined) patch["manager_phone"] = data.managerPhone;
    if (data.waAccountId !== undefined) patch["wa_account_id"] = data.waAccountId;

    const { data: row, error } = await c
      .from("tenant_profiles")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .select("tenant_id, name, owner_name, city, cuisine, hours, average_check_cents, notes, manager_phone, wa_account_id")
      .single();

    if (error || !row) throw new Error(error?.message ?? "Restaurant profile could not be saved.");
    return toProfile(row as Record<string, unknown>, data.tenantId);
  });