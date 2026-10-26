import { getRequest } from "@tanstack/react-start/server";

import { db } from "./db.server";

export type TenantRole = "owner" | "manager" | "staff";
export const ANY_ROLE: TenantRole[] = ["owner", "manager", "staff"];
export const MANAGERS: TenantRole[] = ["owner", "manager"];

/**
 * Fail-closed: authentication is REQUIRED unless someone has explicitly opted
 * in to the insecure demo mode (ALLOW_INSECURE_DEMO=true) on a non-https,
 * non-production deployment. Forgetting an env var can therefore never open the
 * app; it can only lock it down. Every server function reaches the database
 * through the service role (RLS bypassed), so this switch is the tenant wall.
 */
export const authRequired = () => {
  const demo = process.env["ALLOW_INSECURE_DEMO"] === "true";
  const publicUrl = (process.env["PUBLIC_APP_URL"] ?? "").trim().toLowerCase();
  const production = process.env["NODE_ENV"] === "production";
  if (demo && !production && !publicUrl.startsWith("https://")) return false;
  return true;
};

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

/** Authenticated user's id for audit fields, or null when auth is disabled (local/demo). */
export async function actorId(): Promise<string | null> {
  if (!authRequired()) return null;
  return currentUserId();
}

export async function requireUser(): Promise<string | null> {
  if (!authRequired()) return null;
  const id = await currentUserId();
  if (!id) throw deny(401, "Please sign in.");
  return id;
}

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