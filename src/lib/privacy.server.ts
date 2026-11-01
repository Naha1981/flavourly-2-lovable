import { db } from "./db.server";
import { authorizeTenant, actorId } from "./tenant-auth.server";
import { redactExport, validateDeleteConfirmation } from "./privacy";

export async function exportWorkspaceData(tenantId: string) {
  await authorizeTenant(tenantId, ["owner"]);
  const userId = await actorId();
  if (!userId) throw new Error("An authenticated owner is required.");
  const c = await db();
  const { data, error } = await c.rpc("privacy_export_workspace", {
    p_tenant: tenantId,
    p_actor: userId,
  });
  if (error || !data || typeof data !== "object")
    throw new Error(
      "Workspace export could not complete. Database privacy setup or owner access is unavailable. No partial download was created.",
    );
  return JSON.stringify(
    redactExport({ version: 1, tenantId, exportedAt: new Date().toISOString(), data }),
  );
}

export async function deleteWorkspaceData(tenantId: string, confirmation: string) {
  validateDeleteConfirmation(tenantId, confirmation);
  await authorizeTenant(tenantId, ["owner"]);
  const userId = await actorId();
  if (!userId) throw new Error("An authenticated owner is required.");
  const c = await db();
  const { data, error } = await c.rpc("privacy_delete_workspace", {
    p_tenant: tenantId,
    p_actor: userId,
  });
  if (error || !data || data.deleted !== true || data.tenantId !== tenantId)
    throw new Error(
      "Workspace deletion could not complete. Check owner access, active subscriptions and privacy database setup. No success is assumed.",
    );
  return { ok: true as const, result: data };
}
