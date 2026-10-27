import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

/** Reading is open to any member; running the agent, changing its autonomy mode or approving its actions is owner/manager only. */
async function guard(tenantId: string, level: "any" | "manager" = "any") {
  const { authorizeTenant, ANY_ROLE, MANAGERS } = await import("../tenant-auth.server");
  await authorizeTenant(tenantId, level === "manager" ? MANAGERS : ANY_ROLE);
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
    await guard(data.tenantId, "manager");
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
    await guard(data.tenantId, "manager");
    const { setRevenueEmployeeMode } = await import("./revenue-employee.server");
    return setRevenueEmployeeMode(data.tenantId, data.mode);
  });

export const approveRevenueActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, actionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId, "manager");
    const { actorId } = await import("../tenant-auth.server");
    const { approveRevenueAction } = await import("./revenue-employee.server");
    // The approver is the signed-in user, never a name supplied by the browser.
    const approvedBy = (await actorId()) ?? "demo-mode";
    return approveRevenueAction({ tenantId: data.tenantId, actionId: data.actionId, approvedBy });
  });
