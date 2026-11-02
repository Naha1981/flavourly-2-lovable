import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export type ReplyUsage = {
  allowed: boolean;
  reason?: string | null;
  monthlyUsed?: number;
  monthlyLimit?: number;
  dailyUsed?: number;
  dailyLimit?: number;
  trialUsed?: number;
  trialLimit?: number | null;
};
export const getReplyUsage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<ReplyUsage> => {
    const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId, MANAGERS);
    const { readReplyUsage } = await import("./whatsapp-usage-read.server");
    return readReplyUsage(data.tenantId);
  });
