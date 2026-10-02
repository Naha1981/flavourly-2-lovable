import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);
export type { ApprovalRequest } from "./approval.server";

const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export const listApprovals = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { listPendingApprovals } = await import("./approval.server");
    return listPendingApprovals(data.tenantId);
  });

export const resolveApprovalRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    tenantId: tenant,
    approvalId: z.string().uuid(),
    approved: z.boolean(),
    resolvedBy: z.string().trim().min(1).max(120),
  }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { resolveApproval } = await import("./approval.server");
    return resolveApproval(data);
  });
