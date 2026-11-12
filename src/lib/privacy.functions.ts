import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
export const exportWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId, ["owner"]);
    const { exportWorkspaceData } = await import("./privacy.server");
    return exportWorkspaceData(data.tenantId);
  });
export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, confirmation: z.string().max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId, ["owner"]);
    const { deleteWorkspaceData } = await import("./privacy.server");
    return deleteWorkspaceData(data.tenantId, data.confirmation);
  });
