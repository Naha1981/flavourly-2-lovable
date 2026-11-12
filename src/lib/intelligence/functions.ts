import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

async function guard(tenantId: string) {
  const { authorizeTenant } = await import("../tenant-auth.server");
  await authorizeTenant(tenantId);
}

export const getRevenueEmployeeSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { listRevenueEmployeeSnapshot } = await import("./revenue-employee.server");
    return listRevenueEmployeeSnapshot(data.tenantId);
  });

export const runRevenueEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, objective: z.string().trim().max(800).optional() }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { runRevenueEmployee } = await import("./revenue-employee.server");
    return data.objective
      ? runRevenueEmployee({ tenantId: data.tenantId, objective: data.objective })
      : runRevenueEmployee({ tenantId: data.tenantId });
  });

export const askRevenueEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, question: z.string().trim().min(3).max(1200) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { askRevenueEmployee } = await import("./revenue-employee.server");
    return askRevenueEmployee({ tenantId: data.tenantId, question: data.question });
  });

export const setRevenueEmployeeModeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, mode: z.enum(["disabled", "shadow", "approval_only", "active"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { setRevenueEmployeeMode } = await import("./revenue-employee.server");
    return setRevenueEmployeeMode(data.tenantId, data.mode);
  });

export async function requireApprovalActorId(): Promise<string> {
  const { actorId } = await import("../tenant-auth.server");
  const id = await actorId();
  if (!id) {
    throw new Response(JSON.stringify({ error: "Please sign in." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return id;
}

export const approveRevenueActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, actionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const approvedBy = await requireApprovalActorId();
    const { approveRevenueAction } = await import("./revenue-employee.server");
    return approveRevenueAction({ ...data, approvedBy });
  });
