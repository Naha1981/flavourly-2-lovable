import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getActivationReadiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId, MANAGERS);
    const { readActivationReadiness } = await import("./activation-readiness.server");
    return readActivationReadiness(data.tenantId);
  });
