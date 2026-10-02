import { db } from "./db.server";
import * as wa from "./whatsapp.server";

/** Finds the operator account for a tenant: stored id first, then the idempotent bootstrap call. */
export async function resolveWaAccountId(
  tenantId: string,
  hint?: string | null,
): Promise<string | null> {
  if (hint) return hint;
  const c = await db();
  const { data } = await c
    .from("tenant_profiles")
    .select("name, wa_account_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (data?.wa_account_id) return data.wa_account_id as string;
  const boot = await wa.bootstrap(tenantId, (data?.name as string | undefined) ?? tenantId);
  if (!boot.ok) return null;
  await c
    .from("tenant_profiles")
    .update({ wa_account_id: boot.data.waAccountId })
    .eq("tenant_id", tenantId);
  return boot.data.waAccountId;
}

export async function sendWhatsApp(
  tenantId: string,
  phone: string,
  text: string,
  accountHint?: string | null,
) {
  const { assertCanSendNow } = await import("./billing.server");
  await assertCanSendNow(tenantId);
  const accountId = await resolveWaAccountId(tenantId, accountHint);
  if (!accountId) return { ok: false as const, error: "No WhatsApp account for tenant" };
  return wa.sendText(tenantId, accountId, phone.replace(/\D/g, ""), text);
}
