import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Workspace = { tenantId: string; name: string; role: string };

/** Tells the browser whether login is enforced (server-side env, so it can't drift from the checks). */
export const getAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { authRequired } = await import("./tenant-auth.server");
  return { required: authRequired() };
});

export const myWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Workspace | null> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data } = await c
      .from("tenant_members")
      .select("tenant_id, role, created_at")
      .eq("user_id", context.userId)
      .order("created_at")
      .limit(1);
    const m = data?.[0];
    if (!m) return null;
    const { data: t } = await c
      .from("tenant_profiles")
      .select("name")
      .eq("tenant_id", m["tenant_id"])
      .maybeSingle();
    return {
      tenantId: m["tenant_id"] as string,
      name: (t?.name as string | undefined) ?? (m["tenant_id"] as string),
      role: m["role"] as string,
    };
  });

/** First sign-in: creates the restaurant and makes the caller its owner. Safe to call twice. */
export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ restaurantName: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Workspace> => {
    const { db } = await import("./db.server");
    const { ensureWorkspace } = await import("./workspace.server");
    return ensureWorkspace(await db(), context.userId, data.restaurantName);
  });
