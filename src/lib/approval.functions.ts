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
    // Accepted for local/demo only; production always records the authenticated user.
    resolvedBy: z.string().trim().min(1).max(120).optional(),
    messageText: z.string().trim().min(1).max(4000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { actorId } = await import("./tenant-auth.server");
    const resolvedBy = (await actorId()) ?? data.resolvedBy ?? "unknown";
    const { resolveApproval } = await import("./approval.server");
    return resolveApproval({
      tenantId: data.tenantId,
      approvalId: data.approvalId,
      approved: data.approved,
      resolvedBy,
      ...(data.messageText ? { editedMessage: data.messageText } : {}),
    });
  });
