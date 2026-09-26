/**
 * Server-only client for the NahaLabs WhatsApp operator (Baileys service).
 * The browser never sees OPERATOR_API_KEY — it only talks to our server functions.
 */
const APP_ID = "flavourly";

type OpResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function op<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<OpResult<T>> {
  const baseUrl = process.env["OPERATOR_URL"];
  const apiKey = process.env["OPERATOR_API_KEY"];
  if (!baseUrl || !apiKey) return { ok: false, error: "WhatsApp service isn't configured." };

  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey);
  headers.set("X-App-Id", APP_ID);
  headers.set("X-Tenant-Id", tenantId);
  if (init.body) headers.set("Content-Type", "application/json");

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      console.error("operator error", path, res.status, body);
      const message = typeof body.message === "string" ? body.message : `WhatsApp service error (${res.status})`;
      return { ok: false, error: message, status: res.status };
    }
    return { ok: true, data: body as T };
  } catch (error) {
    console.error("operator unreachable", path, error);
    return { ok: false, error: "Couldn't reach the WhatsApp service. It may be waking up — try again in a moment." };
  }
}

export type WaStatus = {
  waAccountId: string;
  status: string;
  isConnected: boolean;
  phoneNumber: string | null;
  qrCode: string | null;
  qrExpiresAt: string | null;
};

export function bootstrap(tenantId: string, restaurantName: string) {
  return op<{ waAccountId: string; status: string; created: boolean }>(tenantId, "/accounts/bootstrap", {
    method: "POST",
    body: JSON.stringify({ label: `${restaurantName} · Flavourly`, appId: APP_ID, tenantId }),
  });
}

export async function status(tenantId: string, waAccountId: string): Promise<OpResult<WaStatus>> {
  const id = encodeURIComponent(waAccountId);
  const [s, q] = await Promise.all([
    op<{ status: string; isConnected: boolean; phoneNumber: string | null }>(tenantId, `/accounts/${id}/status`),
    op<{ status: string; qrCode: string | null; qrExpiresAt: string | null }>(tenantId, `/accounts/${id}/qr`),
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

export function reconnect(tenantId: string, waAccountId: string) {
  return op<unknown>(tenantId, `/accounts/${encodeURIComponent(waAccountId)}/connect`, { method: "POST" });
}

export function pairingCode(tenantId: string, waAccountId: string, phoneNumber: string) {
  return op<{ pairingCode?: string; code?: string }>(
    tenantId,
    `/accounts/${encodeURIComponent(waAccountId)}/pairing-code`,
    { method: "POST", body: JSON.stringify({ phoneNumber }) },
  );
}

export function sendText(tenantId: string, waAccountId: string, to: string, text: string) {
  return op<unknown>(tenantId, "/send", {
    method: "POST",
    body: JSON.stringify({ waAccountId, to, text, type: "text" }),
  });
}
