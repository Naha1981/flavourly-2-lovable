import { getRequest } from "@tanstack/react-start/server";

import { db } from "./db.server";

export type TenantRole = "owner" | "manager" | "staff";
export const ANY_ROLE: TenantRole[] = ["owner", "manager", "staff"];
export const MANAGERS: TenantRole[] = ["owner", "manager"];

/**
 * Enforcement is opt-in (REQUIRE_AUTH=true) because the sign-in screens were
 * placeholders until now: turning it on before accounts exist would lock the
 * owner out. Flip it once you've signed up and can see your workspace.
 */
export const authRequired = () => process.env["REQUIRE_AUTH"] === "true";

const deny = (status: 401 | 403, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });

async function currentUserId(): Promise<string | null> {
  const header = getRequest()?.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** Any signed-in user (for calls that aren't tied to a tenant). No-op unless enforced. */
export async function requireUser(): Promise<string | null> {
  if (!authRequired()) return null;
  const id = await currentUserId();
  if (!id) throw deny(401, "Please sign in.");
  return id;
}

/** Signed-in user who belongs to `tenantId` with one of `roles`. No-op unless enforced. */
export async function authorizeTenant(
  tenantId: string,
  roles: TenantRole[] = ANY_ROLE,
): Promise<void> {
  if (!authRequired()) return;
  const userId = await currentUserId();
  if (!userId) throw deny(401, "Please sign in.");
  const c = await db();
  const { data } = await c
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !roles.includes(data.role as TenantRole))
    throw deny(403, "You don't have access to this restaurant.");
}
