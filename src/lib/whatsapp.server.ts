/**
 * Server-only client for the NahaLabs WhatsApp operator (Baileys service).
 * The browser never sees OPERATOR_API_KEY or tenant credentials.
 */
import { APP_URL, db } from "./db.server";

const APP_ID = "flavourly";
type OpResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; waking?: boolean };
type Credential = "platform" | { tenantToken: string };

const tokenInflight = new Map<string, Promise<string | null>>();

async function op<T>(
  tenantId: string,
  path: string,
  init: RequestInit = {},
  credential: Credential = "platform",
): Promise<OpResult<T>> {
  const baseUrl = process.env["OPERATOR_URL"];
  if (!baseUrl) return { ok: false, error: "WhatsApp service isn't configured." };

  const headers = new Headers(init.headers);
  if (credential === "platform") {
    const apiKey = process.env["OPERATOR_API_KEY"];
    if (!apiKey) return { ok: false, error: "WhatsApp service isn't configured." };
    headers.set("X-API-Key", apiKey);
    headers.set("X-App-Id", APP_ID);
    headers.set("X-Tenant-Id", tenantId);
  } else {
    headers.set("X-NahaLabs-Tenant-Token", credential.tenantToken);
  }
  if (init.body) headers.set("Content-Type", "application/json");

  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + path, { ...init, headers });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      console.error("operator error", path, res.status, body);
      const message = typeof body["message"] === "string"
        ? String(body["message"])
        : "WhatsApp service error (" + res.status + ")";
      // Render free-tier cold starts surface as gateway errors while the
      // operator boots. Callers can show a "waking" state instead of a failure.
      const waking = res.status === 502 || res.status === 503 || res.status === 504;
      return { ok: false, error: message, status: res.status, waking };
    }
    return { ok: true, data: body as T };
  } catch (error) {
    console.error("operator unreachable", path, error);
    return {
      ok: false,
      error: "Couldn't reach the WhatsApp service. It may be waking up — try again in a moment.",
      waking: true,
    };
  }
}

async function ensureTenantToken(tenantId: string): Promise<string | null> {
  const c = await db();
  const { data: profile } = await c
    .from("tenant_profiles")
    .select("wa_operator_tenant_token")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const existing = profile?.wa_operator_tenant_token as string | undefined;
  if (existing) return existing;

  const running = tokenInflight.get(tenantId);
  if (running) return running;

  const request = (async () => {
    const issued = await op<{ tenantToken?: string }>(
      tenantId,
      "/accounts/tenant-token",
      { method: "POST", body: JSON.stringify({ appId: APP_ID, tenantId, rotate: true }) },
      "platform",
    );
    if (!issued.ok || !issued.data.tenantToken) return null;

    const { error } = await c
      .from("tenant_profiles")
      .update({ wa_operator_tenant_token: issued.data.tenantToken })
      .eq("tenant_id", tenantId);
    if (error) {
      console.error("failed to persist WhatsApp tenant credential", error);
      return null;
    }
    return issued.data.tenantToken;
  })();

  tokenInflight.set(tenantId, request);
  try {
    return await request;
  } finally {
    if (tokenInflight.get(tenantId) === request) tokenInflight.delete(tenantId);
  }
}

async function storeTenantToken(tenantId: string, token: string): Promise<void> {
  const c = await db();
  const { error } = await c
    .from("tenant_profiles")
    .update({ wa_operator_tenant_token: token })
    .eq("tenant_id", tenantId);
  if (error) throw new Error("WhatsApp credential storage failed: " + error.message);
}

export type WaStatus = {
  waAccountId: string;
  status: string;
  isConnected: boolean;
  phoneNumber: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
};

export async function bootstrap(tenantId: string, restaurantName: string) {
  const appUrl = APP_URL();
  if (!appUrl) return { ok: false as const, error: "PUBLIC_APP_URL must be configured so WhatsApp can deliver inbound messages." };

  const result = await op<{ waAccountId: string; status: string; created: boolean; tenantToken?: string }>(
    tenantId,
    "/accounts/bootstrap",
    {
      method: "POST",
      body: JSON.stringify({
        label: restaurantName + " · Flavourly",
        appId: APP_ID,
        tenantId,
        webhookUrl: appUrl + "/api/public/webhooks/whatsapp",
      }),
    },
    "platform",
  );
  if (!result.ok) return result;

  if (result.data.tenantToken) await storeTenantToken(tenantId, result.data.tenantToken);
  else if (!(await ensureTenantToken(tenantId)))
    return { ok: false as const, error: "WhatsApp account was prepared, but the tenant credential could not be secured." };

  return {
    ok: true as const,
    data: { waAccountId: result.data.waAccountId, status: result.data.status, created: result.data.created },
  };
}

export async function status(tenantId: string, waAccountId: string): Promise<OpResult<WaStatus>> {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false, error: "WhatsApp tenant credential is not available." };
  const id = encodeURIComponent(waAccountId);
  const [s, q] = await Promise.all([
    op<{ status: string; isConnected: boolean; phoneNumber: string | null }>(tenantId, "/accounts/" + id + "/status", {}, { tenantToken: token }),
    op<{ status: string; qrCode: string | null; qrExpiresAt: string | null }>(tenantId, "/accounts/" + id + "/qr", {}, { tenantToken: token }),
  ]);
  if (!s.ok) return s;
  return {
    ok: true,
    data: {
      waAccountId,
      status: s.data.isConnected ? "connected" : q.ok ? q.data.status : s.data.status,
      isConnected: Boolean(s.data.isConnected),
      phoneNumber: s.data.phoneNumber ?? null,
      qrCode: q.ok && !s.data.isConnected ? q.data.qrCode : null,
      qrExpiresAt: q.ok ? q.data.qrExpiresAt : null,
    },
  };
}

export async function tenantAccounts(tenantId: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ accounts: Array<{ waAccountId: string; status: string; isConnected: boolean; phoneNumber: string | null }> }>(
    tenantId, "/accounts/mine", {}, { tenantToken: token },
  );
}

export async function reconnect(tenantId: string, waAccountId: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ status?: string; qrCode?: string | null }>(
    tenantId, "/accounts/" + encodeURIComponent(waAccountId) + "/connect", { method: "POST" }, { tenantToken: token },
  );
}

export async function pairingCode(tenantId: string, waAccountId: string, phoneNumber: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ pairingCode?: string; code?: string }>(
    tenantId, "/accounts/" + encodeURIComponent(waAccountId) + "/pairing-code",
    { method: "POST", body: JSON.stringify({ phoneNumber }) }, { tenantToken: token },
  );
}

export async function disconnect(tenantId: string, waAccountId: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ status?: string }>(
    tenantId, "/accounts/" + encodeURIComponent(waAccountId) + "/disconnect", { method: "POST" }, { tenantToken: token },
  );
}

export async function reset(tenantId: string, waAccountId: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ status?: string }>(
    tenantId, "/accounts/" + encodeURIComponent(waAccountId) + "/reset", { method: "POST" }, { tenantToken: token },
  );
}

export async function sendText(tenantId: string, waAccountId: string, to: string, text: string) {
  const token = await ensureTenantToken(tenantId);
  if (!token) return { ok: false as const, error: "WhatsApp tenant credential is not available." };
  return op<{ messageId?: string; status?: string }>(
    tenantId, "/send",
    { method: "POST", body: JSON.stringify({ waAccountId, to, text, type: "text" }) },
    { tenantToken: token },
  );
}