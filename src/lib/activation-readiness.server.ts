import { db } from "./db.server";
import { replyUsageErrorReference } from "./whatsapp-usage-diagnostic.server";
/** Reads only. Never enables a switch, links a number or calls a paid provider. */
export async function readActivationReadiness(tenantId: string) {
  const c = await db();
  const [allowance, channel] = await Promise.all([
    c.rpc("wa_reply_usage", { p_tenant: tenantId }),
    c.from("wa_channels").select("account_id").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    connectEnabled: process.env["WHATSAPP_CONNECT_ENABLED"] === "true",
    sendEnabled: process.env["WHATSAPP_SEND_ENABLED"] === "true",
    aiEnabled: process.env["WHATSAPP_AI_ENABLED"] === "true",
    providerConfigured: Boolean(process.env["ZERNIO_API_KEY"]),
    aiConfigured: Boolean(process.env["GROQ_API_KEY"]),
    allowanceRpcReady: !allowance.error && Boolean(allowance.data),
    allowanceReference:
      allowance.error || !allowance.data ? replyUsageErrorReference(allowance.error) : null,
    accountBound: !channel.error && Boolean(channel.data?.account_id),
    channelCheckFailed: Boolean(channel.error),
  };
}
