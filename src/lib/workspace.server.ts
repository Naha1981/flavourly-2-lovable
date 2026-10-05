import type { SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "./restaurant-profile";
import type { Workspace } from "./workspace.functions";

/**
 * First sign-in: creates the restaurant and makes the caller its owner.
 * Safe to call twice — an existing membership is returned unchanged.
 */
export async function ensureWorkspace(
  c: Pick<SupabaseClient, "from">,
  userId: string,
  restaurantName: string,
): Promise<Workspace> {
  const { data: existing } = await c
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .limit(1);
  if (existing?.[0]) {
    const { data: t } = await c
      .from("tenant_profiles")
      .select("name")
      .eq("tenant_id", existing[0]["tenant_id"])
      .maybeSingle();
    return {
      tenantId: existing[0]["tenant_id"] as string,
      name: (t?.["name"] as string | undefined) ?? restaurantName,
      role: existing[0]["role"] as string,
    };
  }

  const base = slugify(restaurantName);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await c.from("tenant_profiles").insert({ tenant_id: slug, name: restaurantName });
    if (error?.code === "23505") continue; // slug taken, try another
    if (error) throw error;
    const { error: mErr } = await c
      .from("tenant_members")
      .insert({ tenant_id: slug, user_id: userId, role: "owner" });
    if (mErr) throw mErr;
    return { tenantId: slug, name: restaurantName, role: "owner" };
  }
  throw new Error("Couldn't reserve a unique restaurant address. Please try again.");
}
