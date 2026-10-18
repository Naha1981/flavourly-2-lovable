import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamMember = { userId: string; email: string; role: "owner" | "manager" | "staff"; joinedAt: string };
export type WorkspaceSummary = { tenantId: string; name: string; role: "owner" | "manager" | "staff" };
export type InviteSummary = { token: string; role: "manager" | "staff"; expiresAt: string } | null;

const tenant = z.string().trim().min(1).max(100);
const inviteRole = z.enum(["manager", "staff"]);

const deny = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });

/** Owner-only guard: the caller must be an owner of this restaurant. */
async function ownerOnly(tenantId: string) {
  const { authorizeTenant } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, ["owner"]);
}

export const listMyWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceSummary[]> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("tenant_members")
      .select("tenant_id, role, created_at")
      .eq("user_id", context.userId)
      .order("created_at");
    const ids = (rows ?? []).map((r) => String(r["tenant_id"]));
    const { data: names } = ids.length
      ? await c.from("tenant_profiles").select("tenant_id, name").in("tenant_id", ids)
      : { data: [] as Record<string, unknown>[] };
    const byId = new Map((names ?? []).map((n) => [String(n["tenant_id"]), String(n["name"] ?? "")]));
    return (rows ?? []).map((r) => ({
      tenantId: String(r["tenant_id"]),
      name: byId.get(String(r["tenant_id"])) || String(r["tenant_id"]),
      role: r["role"] as WorkspaceSummary["role"],
    }));
  });

export const createAnotherWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }): Promise<WorkspaceSummary> => {
    const { db } = await import("./db.server");
    const { slugify } = await import("./restaurant-profile");
    const c = await db();
    const { count } = await c
      .from("tenant_members")
      .select("tenant_id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("role", "owner");
    if ((count ?? 0) >= 20) throw deny(400, "You have reached the workspace limit.");
    const base = slugify(data.name) || "restaurant";
    for (let i = 0; i < 6; i++) {
      const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await c.from("tenant_profiles").insert({ tenant_id: slug, name: data.name });
      if (error?.code === "23505") continue;
      if (error) throw error;
      const { error: mErr } = await c.from("tenant_members").insert({ tenant_id: slug, user_id: context.userId, role: "owner" });
      if (mErr) throw mErr;
      return { tenantId: slug, name: data.name, role: "owner" };
    }
    throw deny(409, "Couldn't reserve a unique restaurant address. Please try again.");
  });

export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<TeamMember[]> => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { db } = await import("./db.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await db();
    const { data: rows } = await c
      .from("tenant_members")
      .select("user_id, role, created_at")
      .eq("tenant_id", data.tenantId)
      .order("created_at");
    return Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(String(r["user_id"]));
        return {
          userId: String(r["user_id"]),
          email: u.user?.email ?? "",
          role: r["role"] as TeamMember["role"],
          joinedAt: String(r["created_at"]),
        };
      }),
    );
  });

export const getTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<InviteSummary> => {
    await ownerOnly(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("tenant_invites")
      .select("token, role, expires_at")
      .eq("tenant_id", data.tenantId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const r = rows?.[0];
    return r ? { token: String(r["token"]), role: r["role"] as "manager" | "staff", expiresAt: String(r["expires_at"]) } : null;
  });

export const createTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, role: inviteRole }).parse(d))
  .handler(async ({ data, context }): Promise<InviteSummary> => {
    await ownerOnly(data.tenantId);
    const { db } = await import("./db.server");
    const { randomBytes } = await import("node:crypto");
    const c = await db();
    await c.from("tenant_invites").update({ revoked_at: new Date().toISOString() }).eq("tenant_id", data.tenantId).is("revoked_at", null);
    const token = randomBytes(24).toString("hex");
    const { data: row, error } = await c
      .from("tenant_invites")
      .insert({ tenant_id: data.tenantId, token, role: data.role, created_by: context.userId })
      .select("token, role, expires_at")
      .single();
    if (error) throw error;
    return { token: String(row["token"]), role: row["role"] as "manager" | "staff", expiresAt: String(row["expires_at"]) };
  });

export const revokeTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await ownerOnly(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    await c.from("tenant_invites").update({ revoked_at: new Date().toISOString() }).eq("tenant_id", data.tenantId).is("revoked_at", null);
    return { ok: true };
  });

/** Public: shows the restaurant name and role for a valid link, so people know what they are joining. */
export const getInviteInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data }): Promise<{ name: string; role: "manager" | "staff" } | null> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data: inv } = await c
      .from("tenant_invites")
      .select("tenant_id, role")
      .eq("token", data.token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!inv) return null;
    const { data: p } = await c.from("tenant_profiles").select("name").eq("tenant_id", inv["tenant_id"]).maybeSingle();
    return { name: String(p?.["name"] ?? inv["tenant_id"]), role: inv["role"] as "manager" | "staff" };
  });

export const acceptTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<WorkspaceSummary> => {
    const { db } = await import("./db.server");
    const c = await db();
    const { data: inv } = await c
      .from("tenant_invites")
      .select("tenant_id, role")
      .eq("token", data.token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!inv) throw deny(410, "This invite link is no longer valid. Ask the restaurant owner for a new one.");
    const tenantId = String(inv["tenant_id"]);
    const { data: existing } = await c
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", context.userId)
      .maybeSingle();
    let role = (existing?.["role"] ?? inv["role"]) as WorkspaceSummary["role"];
    if (!existing) {
      const { error } = await c.from("tenant_members").insert({ tenant_id: tenantId, user_id: context.userId, role: inv["role"] });
      if (error) throw error;
      role = inv["role"] as WorkspaceSummary["role"];
    }
    const { data: p } = await c.from("tenant_profiles").select("name").eq("tenant_id", tenantId).maybeSingle();
    return { tenantId, name: String(p?.["name"] ?? tenantId), role };
  });

async function ownerCountExcluding(tenantId: string, userId: string) {
  const { db } = await import("./db.server");
  const c = await db();
  const { count } = await c
    .from("tenant_members")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .neq("user_id", userId);
  return count ?? 0;
}

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, userId: z.string().uuid(), role: z.enum(["owner", "manager", "staff"]) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await ownerOnly(data.tenantId);
    if (data.role !== "owner" && (await ownerCountExcluding(data.tenantId, data.userId)) === 0)
      throw deny(400, "A restaurant must keep at least one owner.");
    const { db } = await import("./db.server");
    const c = await db();
    const { error } = await c.from("tenant_members").update({ role: data.role }).eq("tenant_id", data.tenantId).eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const leavingSelf = data.userId === context.userId;
    if (leavingSelf) {
      const { authorizeTenant } = await import("./tenant-auth.server");
      await authorizeTenant(data.tenantId);
    } else {
      await ownerOnly(data.tenantId);
    }
    const { db } = await import("./db.server");
    const c = await db();
    const { data: target } = await c
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (target?.["role"] === "owner" && (await ownerCountExcluding(data.tenantId, data.userId)) === 0)
      throw deny(400, "A restaurant must keep at least one owner.");
    const { error } = await c.from("tenant_members").delete().eq("tenant_id", data.tenantId).eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });
