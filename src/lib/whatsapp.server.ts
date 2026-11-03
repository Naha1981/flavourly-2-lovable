/** Server-only WhatsApp inbox transport. No templates, broadcasts or cold sends. */
import { APP_URL, db } from "./db.server";
type Result<T> =
  { ok: true; data: T } | { ok: false; error: string; status?: number; waking?: boolean };
export type WaStatus = {
  waAccountId: string;
  status: string;
  isConnected: boolean;
  phoneNumber: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
};
const BASE = "https://zernio.com/api/v1";
async function api<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const key = process.env["ZERNIO_API_KEY"];
  if (!key) return { ok: false, error: "WhatsApp isn't configured yet." };
  try {
    const res = await fetch(BASE + path, {
      ...init,
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    });
    if (!res.ok)
      return {
        ok: false,
        error: "WhatsApp couldn't complete that request. The team can try again later.",
        status: res.status,
      };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "WhatsApp couldn't be reached. No automatic retry was sent." };
  }
}
export async function channel(tenantId: string) {
  const { data, error } = await (
    await db()
  )
    .from("wa_channels")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error("Could not verify WhatsApp ownership");
  return data;
}
export async function bootstrap(
  tenantId: string,
  restaurantName: string,
): Promise<Result<{ waAccountId: string; status: string; created: boolean; authUrl?: string }>> {
  if (process.env["WHATSAPP_CONNECT_ENABLED"] !== "true")
    return {
      ok: false,
      error: "WhatsApp connection is paused until the free account allowance is checked.",
    };
  const c = await db();
  let row = await channel(tenantId);
  if (row?.account_id)
    return {
      ok: false,
      error: "This plan already has a linked number. Ask the team before replacing it.",
    };
  // Shared team allowance: never start another paid connected account.
  const capacity = await api<{ accounts: Array<{ isActive?: boolean }> }>("/accounts");
  if (!capacity.ok || !Array.isArray(capacity.data.accounts))
    return {
      ok: false,
      error: "The free connection allowance could not be verified. No number was connected.",
    };
  if (capacity.data.accounts.filter((account) => account.isActive === true).length >= 2)
    return {
      ok: false,
      error:
        "The two free shared connections are in use. No paid connection was started. Ask the team for help.",
    };
  if (!row) {
    const result = await api<{ profile: { _id?: string; id?: string } }>("/profiles", {
      method: "POST",
      body: JSON.stringify({ name: restaurantName, externalId: `flavourly:${tenantId}` }),
    });
    if (!result.ok) return result;
    const id = result.data.profile?._id ?? result.data.profile?.id;
    if (!id) return { ok: false, error: "WhatsApp setup is incomplete. Ask the team to check it." };
    const saved = await c
      .from("wa_channels")
      .insert({ tenant_id: tenantId, profile_id: id })
      .select()
      .single();
    if (saved.error)
      return {
        ok: false,
        error: "Could not save WhatsApp setup. Ask the team to check before retrying.",
      };
    row = saved.data;
  }
  const redirect = APP_URL();
  if (!redirect.startsWith("https://"))
    return { ok: false, error: "A secure return address is required." };
  const webhookSecret = process.env["ZERNIO_WEBHOOK_SECRET"];
  if (!webhookSecret)
    return { ok: false, error: "Inbox verification is not configured. No number was connected." };
  const webhookUrl = redirect + "/api/public/webhooks/whatsapp";
  const existingHooks = await api<{
    webhooks: Array<{ url?: string; isActive?: boolean; profileIds?: string[]; events?: string[] }>;
  }>("/webhooks/settings");
  if (!existingHooks.ok)
    return { ok: false, error: "Inbox routing could not be checked. Please try again later." };
  const requiredEvents = [
    "message.received",
    "message.sent",
    "message.delivered",
    "message.read",
    "message.failed",
  ];
  const routed = existingHooks.data.webhooks?.some(
    (hook) =>
      hook.url === webhookUrl &&
      hook.isActive === true &&
      hook.profileIds?.length === 1 &&
      hook.profileIds[0] === row.profile_id &&
      requiredEvents.every((event) => hook.events?.includes(event)),
  );
  if (!routed) {
    const created = await api<unknown>("/webhooks/settings", {
      method: "POST",
      body: JSON.stringify({
        name: "Flavourly " + String(row.profile_id).slice(-20),
        url: webhookUrl,
        secret: webhookSecret,
        profileIds: [row.profile_id],
        events: requiredEvents,
        isActive: true,
      }),
    });
    if (!created.ok)
      return { ok: false, error: "Inbox routing could not be prepared. No number was connected." };
  }
  const result = await api<{ authUrl: string }>(
    `/connect/whatsapp?profileId=${encodeURIComponent(row.profile_id)}&signup=hosted&onboarding=business_app&brandName=Flavourly&redirect_url=${encodeURIComponent(redirect + "/dashboard/settings")}`,
  );
  if (!result.ok) return result;
  try {
    const u = new URL(result.data.authUrl);
    if (u.protocol !== "https:") throw new Error();
  } catch {
    return { ok: false, error: "Invalid connection link." };
  }
  return {
    ok: true,
    data: {
      waAccountId: row.profile_id,
      status: "pending",
      created: !row.account_id,
      authUrl: result.data.authUrl,
    },
  };
}
export async function status(tenantId: string, _hint: string): Promise<Result<WaStatus>> {
  const row = await channel(tenantId);
  if (!row) return { ok: false, error: "No WhatsApp connection has been prepared." };
  const res = await api<{
    accounts: Array<{
      _id?: string;
      id?: string;
      platform?: string;
      profileId?: string | { _id?: string; id?: string };
      isActive?: boolean;
      needsReconnection?: boolean;
      status?: string;
      username?: string;
    }>;
  }>(`/accounts?profileId=${encodeURIComponent(row.profile_id)}&platform=whatsapp`);
  if (!res.ok) return res;
  const accounts = (res.data.accounts ?? []).filter(
    (a) =>
      a.platform === "whatsapp" &&
      (typeof a.profileId === "string" ? a.profileId : (a.profileId?._id ?? a.profileId?.id)) ===
        row.profile_id &&
      a.isActive === true &&
      a.needsReconnection !== true,
  );
  if (accounts.length > 1)
    return {
      ok: false,
      error: "More than one number was found. The team needs to choose the restaurant number.",
    };
  const account = accounts[0];
  const accountId = account?._id ?? account?.id;
  if (row.account_id && accountId !== row.account_id)
    return {
      ok: false,
      error: "The linked number has changed. The team must review it before any replacement.",
    };
  if (accountId) {
    const c = await db();
    const saved = await c
      .from("wa_channels")
      .update({ account_id: accountId })
      .eq("tenant_id", tenantId)
      .eq("profile_id", row.profile_id);
    if (saved.error) return { ok: false, error: "Couldn't verify number ownership." };
    const profile = await c
      .from("tenant_profiles")
      .update({ wa_account_id: accountId })
      .eq("tenant_id", tenantId);
    if (profile.error) return { ok: false, error: "Couldn't finish linking the number." };
  }
  return {
    ok: true,
    data: {
      waAccountId: accountId ?? row.profile_id,
      status: accountId ? "connected" : "pending",
      isConnected: Boolean(accountId),
      phoneNumber: account?.username ?? null,
      qrCode: null,
      qrExpiresAt: null,
    },
  };
}
export async function tenantAccounts(tenantId: string): Promise<
  Result<{
    accounts: Array<{
      waAccountId: string;
      status: string;
      isConnected: boolean;
      phoneNumber: string | null;
    }>;
  }>
> {
  const row = await channel(tenantId);
  return {
    ok: true as const,
    data: {
      accounts: row?.account_id
        ? [
            {
              waAccountId: row.account_id,
              status: "connected",
              isConnected: true,
              phoneNumber: null,
            },
          ]
        : [],
    },
  };
}
export async function reconnect(tenantId: string, _id: string) {
  return bootstrap(tenantId, tenantId);
}
export async function pairingCode(
  _t: string,
  _a: string,
  _p: string,
): Promise<Result<{ pairingCode?: string; code?: string }>> {
  return { ok: false, error: "Use the secure connection page to link your number." };
}
export async function disconnect(_t: string, _a: string): Promise<Result<{ status?: string }>> {
  return {
    ok: false,
    error: "Disconnection is paused. Ask the team to review the connected number.",
  };
}
export const reset = disconnect;
export async function sendText(
  tenantId: string,
  accountId: string,
  phone: string,
  text: string,
): Promise<Result<{ messageId?: string; status?: string }>> {
  if (process.env["WHATSAPP_SEND_ENABLED"] !== "true")
    return { ok: false, error: "Live replies are paused. The draft stays in the inbox." };
  const row = await channel(tenantId);
  if (!row?.account_id || row.account_id !== accountId)
    return { ok: false, error: "That number does not belong to this restaurant." };
  const c = await db();
  const { data: conversation, error } = await c
    .from("wa_conversations")
    .select("id, provider_conversation_id, last_inbound_at")
    .eq("tenant_id", tenantId)
    .eq("guest_phone", phone.replace(/\D/g, ""))
    .not("provider_conversation_id", "is", null)
    .order("last_inbound_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    error ||
    !conversation?.provider_conversation_id ||
    !conversation.last_inbound_at ||
    !Number.isFinite(Date.parse(conversation.last_inbound_at)) ||
    Date.now() - Date.parse(conversation.last_inbound_at) >= 86400000
  )
    return {
      ok: false,
      error: "A recent incoming customer message is required. No paid template was sent.",
    };
  const opt = await c
    .from("wa_opt_outs")
    .select("phone")
    .eq("tenant_id", tenantId)
    .eq("phone", phone.replace(/\D/g, ""))
    .maybeSingle();
  if (opt.error || opt.data) return { ok: false, error: "Replies are paused for this customer." };
  // Fail closed if the new allowance RPC is missing. The old reserve RPC alone
  // does not prove the displayed monthly/trial/pilot limits are installed.
  const allowance = await c.rpc("wa_reply_usage", { p_tenant: tenantId });
  if (allowance.error || !allowance.data || allowance.data.allowed !== true) {
    await c
      .from("wa_conversations")
      .update({
        status: "needs_approval",
        next_action:
          "Reply allowance reached or unavailable. Team must take over; no automatic retry.",
      })
      .eq("tenant_id", tenantId)
      .eq("id", conversation.id);
    return {
      ok: false,
      error: "Reply allowance verification is unavailable or reached. No message was sent.",
    };
  }
  const budget = await c.rpc("wa_reserve_budget", { p_tenant: tenantId, p_kind: "send" });
  if (budget.error || budget.data !== true) {
    await c
      .from("wa_conversations")
      .update({
        status: "needs_approval",
        next_action:
          "Reply allowance reached or unavailable. Team must take over; no automatic retry.",
      })
      .eq("tenant_id", tenantId)
      .eq("id", conversation.id);
    return {
      ok: false,
      error:
        "The reply allowance is reached or unavailable. The team must take over; no automatic retry.",
    };
  }
  const result = await api<{
    success?: boolean;
    data?: { messageId?: string };
    message?: { id?: string };
    messageId?: string;
  }>(`/inbox/conversations/${encodeURIComponent(conversation.provider_conversation_id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ accountId, message: text }),
  });
  if (!result.ok) return result;
  const messageId = result.data.data?.messageId ?? result.data.message?.id ?? result.data.messageId;
  if (typeof messageId !== "string" || !messageId.trim())
    return {
      ok: false,
      error: "Reply acceptance could not be verified. Review delivery before any retry.",
    };
  return { ok: true, data: { messageId, status: "accepted" } };
}
