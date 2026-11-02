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
    const { db } = await import("./db.server");
    const result = await (await db()).rpc("wa_reply_usage", { p_tenant: data.tenantId });
    if (result.error || !result.data) {
      const { replyUsageErrorReference } = await import("./whatsapp-usage-diagnostic.server");
      const reference = replyUsageErrorReference(result.error);
      console.error("[reply-usage] allowance check failed", { reference });
      throw new Error(
        `Reply usage could not be checked. Sending stays paused. Reference: ${reference}`,
      );
    }
    return result.data as ReplyUsage;
  });
