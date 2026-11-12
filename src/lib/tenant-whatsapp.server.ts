/** Tenant-owned messaging credentials never leave server storage after submission. */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { db, APP_URL } from "./db.server";
export const customerOwnedEnabled = () => process.env["WHATSAPP_CUSTOMER_OWNED_ENABLED"] === "true";
function encryptionKey() {
  const key = process.env["WHATSAPP_CREDENTIALS_ENCRYPTION_KEY"];
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Secure messaging storage is not configured.");
  return Buffer.from(key, "hex");
}
export function encryptCredential(value: string, tenant: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  c.setAAD(Buffer.from(tenant));
  return [
    "v1",
    iv.toString("base64"),
    Buffer.concat([c.update(value, "utf8"), c.final()]).toString("base64"),
    c.getAuthTag().toString("base64"),
  ].join(".");
}
export function decryptCredential(value: string, tenant: string) {
  const [v, iv, body, tag] = value.split(".");
  if (v !== "v1" || !iv || !body || !tag) throw new Error("Messaging credentials need attention.");
  const d = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  d.setAAD(Buffer.from(tenant));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}
export async function tenantCredentials(tenant: string) {
  const r = await (
    await db()
  )
    .from("wa_tenant_credentials")
    .select("*")
    .eq("tenant_id", tenant)
    .maybeSingle();
  if (r.error) throw new Error("Messaging credentials could not be checked.");
  return r.data;
}
export async function ownedProviderKey(tenant: string) {
  const r = await tenantCredentials(tenant);
  if (!r) return null;
  if (r.state !== "ready")
    throw new Error("Messaging connection needs attention. Update your connection key.");
  return decryptCredential(r.api_key_ciphertext, tenant);
}
export async function customerApi<T>(
  key: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const r = await fetch("https://zernio.com/api/v1" + path, {
    ...init,
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "Connection key is invalid or expired."
        : r.status === 402
          ? "Your messaging account's free allowance is full. No paid connection was started."
          : "Messaging setup could not be completed. Check your account and try again.",
    );
  return (await r.json()) as T;
}
type Profile = { id?: string; _id?: string; name?: string };
export async function inspectCustomerKey(key: string) {
  if (!customerOwnedEnabled()) throw new Error("Customer-owned setup is not enabled yet.");
  encryptionKey();
  const p = await customerApi<{ profiles: Profile[] }>(key, "/profiles");
  if (!Array.isArray(p.profiles) || !p.profiles.length)
    throw new Error("Create one business profile in your messaging account first.");
  return p.profiles
    .map((p) => ({ id: p._id ?? p.id ?? "", name: p.name ?? "Business profile" }))
    .filter((p) => p.id);
}
export async function saveCustomerKey(tenant: string, key: string, profileId: string) {
  const profiles = await inspectCustomerKey(key);
  if (!profiles.some((p) => p.id === profileId))
    throw new Error("Choose a profile from your own messaging account.");
  const c = await db();
  const bound = await c.from("wa_channels").select("*").eq("tenant_id", tenant).maybeSingle();
  if (bound.error) throw new Error("Current number could not be checked.");
  if (bound.data)
    throw new Error("A messaging setup already exists. Ask the team before replacing it.");
  const accounts = await customerApi<{ accounts: Array<{ isActive?: boolean }> }>(key, "/accounts");
  if (!Array.isArray(accounts.accounts))
    throw new Error("Your messaging allowance could not be verified.");
  if (accounts.accounts.filter((a) => a.isActive === true).length >= 2)
    throw new Error(
      "Your two free connections are already in use. No paid connection was started.",
    );
  const secret = randomBytes(32).toString("hex");
  const stored = await c.rpc("wa_save_customer_connection", {
    p_tenant: tenant,
    p_profile: profileId,
    p_key: encryptCredential(key, tenant),
    p_secret: encryptCredential(secret, tenant),
  });
  if (stored.error || stored.data !== true)
    throw new Error("Could not save secure setup. Existing connections were not replaced.");
  return { saved: true };
}
export async function ensureCustomerWebhook(tenant: string, profileId: string, key: string) {
  const c = await db(),
    r = await tenantCredentials(tenant);
  if (!r) throw new Error("Save your messaging key first.");
  if (r.webhook_id) return;
  const url = APP_URL();
  if (!url.startsWith("https://")) throw new Error("A secure return address is required.");
  const name = "Flavourly " + tenant.slice(0, 35);
  const hooks = await customerApi<{
    webhooks: Array<{
      id?: string;
      _id?: string;
      name?: string;
      url?: string;
      profileIds?: string[];
    }>;
  }>(key, "/webhooks/settings");
  // A matching hook after an interrupted attempt is not blindly trusted or duplicated.
  if (
    hooks.webhooks?.some((h) => h.name === name && h.url === url + "/api/public/webhooks/whatsapp")
  )
    throw new Error(
      "An earlier setup needs verification before retrying. Ask the team to check it.",
    );
  const created = await customerApi<{ webhook?: { id?: string; _id?: string } }>(
    key,
    "/webhooks/settings",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        url: url + "/api/public/webhooks/whatsapp",
        secret: decryptCredential(r.webhook_secret_ciphertext, tenant),
        profileIds: [profileId],
        events: [
          "message.received",
          "message.sent",
          "message.delivered",
          "message.read",
          "message.failed",
          "account.disconnected",
        ],
        isActive: true,
      }),
    },
  );
  const id = created.webhook?._id ?? created.webhook?.id;
  if (!id)
    throw new Error(
      "Inbox route was created but could not be verified. Ask the team before retrying.",
    );
  const saved = await c
    .from("wa_tenant_credentials")
    .update({ webhook_id: id })
    .eq("tenant_id", tenant);
  if (saved.error) throw new Error("Inbox route needs team verification before retrying.");
}
export async function verifyTenantWebhook(parsed: unknown, raw: string, signature: string) {
  const p = parsed as {
    account?: { accountId?: string; id?: string; profileId?: string };
    message?: { account?: { accountId?: string; id?: string; profileId?: string } };
  };
  const a = p?.account ?? p?.message?.account;
  const account = a?.accountId ?? a?.id;
  if (!a?.profileId || !account) return false;
  const c = await db();
  const mapping = await c
    .from("wa_channels")
    .select("tenant_id,credential_mode")
    .eq("account_id", account)
    .eq("profile_id", a.profileId)
    .maybeSingle();
  if (mapping.error || !mapping.data) return false;
  const credentials = await tenantCredentials(mapping.data.tenant_id);
  // Existing approved internal account remains on its existing secret, never a fallback for customer accounts.
  if (mapping.data.credential_mode === "customer" && !credentials) return false;
  const secret = credentials
    ? decryptCredential(credentials.webhook_secret_ciphertext, mapping.data.tenant_id)
    : process.env["ZERNIO_WEBHOOK_SECRET"];
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const x = Buffer.from(signature),
    y = Buffer.from(expected);
  return x.length === y.length && timingSafeEqual(x, y);
}
