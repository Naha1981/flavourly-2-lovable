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

/**
 * Operator-approved Reply Drafter send. Unlike sendWhatsApp (automated flows),
 * this path is used by a human operator replying to a guest, but it still
 * enforces the billing gate, the opt-out list and the tenant's bound account,
 * then writes an audit row. Never trusts a client-supplied account id that is
 * not the tenant's bound account.
 */
export async function sendDrafterReply(
  tenantId: string,
  accountIdHint: string | null,
  to: string,
  text: string,
) {
  const { assertCanSendNow } = await import("./billing.server");
  await assertCanSendNow(tenantId);

  const phone = to.replace(/\D/g, "");
  const c = await db();

  const { data: optOut } = await c
    .from("wa_opt_outs")
    .select("phone")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle();
  if (optOut) return { ok: false as const, error: "This guest has opted out of WhatsApp messages." };

  const { data: profile, error: profileError } = await c
    .from("tenant_profiles")
    .select("wa_account_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (profileError) {
    // Fail closed: without the binding row we cannot validate any client-supplied account id.
    return { ok: false as const, error: "Could not verify the restaurant's WhatsApp account. Try again." };
  }
  const bound = (profile?.wa_account_id as string | null | undefined) ?? null;
  if (accountIdHint && bound && accountIdHint !== bound) {
    return { ok: false as const, error: "That WhatsApp account does not belong to this restaurant." };
  }
  // Fail closed when unbound: a client-supplied hint is only ever used when it
  // matches the tenant's bound account. Otherwise resolve through the stored /
  // bootstrap path so a foreign account id can never be adopted.
  const validatedHint = bound && accountIdHint === bound ? accountIdHint : null;

  const accountId = await resolveWaAccountId(tenantId, validatedHint);
  if (!accountId) return { ok: false as const, error: "No WhatsApp account for tenant" };

  const res = await wa.sendText(tenantId, accountId, phone, text);
  if (!res.ok) return res;

  // The message is already sent; an audit-write failure must not surface as a
  // send failure (which would invite a duplicate retry). Log it and flag the
  // response so the operator UI can show "sent, audit pending" instead of
  // retrying a delivered message. Durable idempotency still needs a UI key.
  let auditRecorded = true;
  try {
    const { error: auditError } = await c.from("outbox_jobs").insert({
      tenant_id: tenantId,
      recipient_phone: phone,
      message_text: text.slice(0, 1500),
      automated: false,
      dedupe_key: `drafter:${tenantId}:${phone}:${Date.now()}`,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      status: "sent",
      campaign_id: null,
      variant: null,
      conversation_id: null,
    });
    if (auditError) {
      auditRecorded = false;
      console.error("reply drafter audit insert failed", auditError);
    }
  } catch (auditError2) {
    auditRecorded = false;
    console.error("reply drafter audit insert failed", auditError2);
  }

  return { ...res, auditRecorded };
}
