import type { ProviderKind, ProviderStatus } from "./types";

type ResearchRequest = {
  tenantId: string;
  restaurantName: string;
  city: string;
  objective: string;
};

type ProviderResponse = {
  provider: ProviderKind;
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
};

const env = (key: string) => process.env[key]?.trim() || "";

const labelMap: Record<ProviderKind, string> = {
  nahallm: "NahaLLM",
  agent_reach: "Agent Reach",
  jev: "Jev UltraFast",
  jev_social: "Jev Social",
  demand_radar: "Demand Radar",
  content_os: "NahaLabs Content OS",
  video_engine: "NahaLabs Video Engine",
  openpost: "OpenPost",
  brightbean: "BrightBean",
  mixpost: "Mixpost",
  whatsapp_operator: "WhatsApp Operator",
};

const modeMap: Record<ProviderKind, ProviderStatus["mode"]> = {
  nahallm: "service",
  agent_reach: "service",
  jev: "browser",
  jev_social: "browser",
  demand_radar: "service",
  content_os: "service",
  video_engine: "service",
  openpost: "service",
  brightbean: "service",
  mixpost: "service",
  whatsapp_operator: "service",
};

const urlMap: Partial<Record<ProviderKind, string>> = {
  nahallm: env("NAHALLM_BASE_URL"),
  agent_reach: env("AGENT_REACH_URL"),
  jev: env("JEV_URL"),
  jev_social: env("JEV_SOCIAL_URL"),
  demand_radar: env("DEMAND_RADAR_URL"),
  content_os: env("CONTENT_OS_URL"),
  video_engine: env("VIDEO_ENGINE_URL"),
  openpost: env("OPENPOST_BASE_URL"),
  brightbean: env("BRIGHTBEAN_BASE_URL"),
  mixpost: env("MIXPOST_BASE_URL"),
  whatsapp_operator: env("OPERATOR_URL"),
};

const tokenMap: Partial<Record<ProviderKind, string>> = {
  nahallm: env("NAHALLM_APP_KEY"),
  agent_reach: env("AGENT_REACH_API_KEY"),
  jev: env("JEV_API_KEY"),
  jev_social: env("JEV_SOCIAL_API_KEY"),
  demand_radar: env("DEMAND_RADAR_API_KEY"),
  content_os: env("CONTENT_OS_API_KEY"),
  video_engine: env("VIDEO_ENGINE_API_KEY"),
  brightbean: env("BRIGHTBEAN_API_KEY"),
  mixpost: env("MIXPOST_API_KEY"),
};

const providerKeys: ProviderKind[] = [
  "nahallm",
  "agent_reach",
  "jev",
  "jev_social",
  "demand_radar",
  "content_os",
  "video_engine",
  "openpost",
  "brightbean",
  "mixpost",
  "whatsapp_operator",
];

export function providerStatuses(): ProviderStatus[] {
  return providerKeys.map((provider) => ({
    provider,
    configured: Boolean(urlMap[provider] && (provider === "openpost" ? env("OPENPOST_API_TOKEN") : true)),
    label: labelMap[provider],
    mode: modeMap[provider],
  }));
}

function authHeaders(provider: ProviderKind) {
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
  const token = provider === "openpost" ? env("OPENPOST_API_TOKEN") : tokenMap[provider];
  if (token) headers.set("Authorization", "Bearer " + token);
  return headers;
}

async function postJson(provider: ProviderKind, url: string, payload: Record<string, unknown>): Promise<ProviderResponse> {
  if (!url) return { provider, ok: false, error: "Provider is not configured." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env("FLAVOURLY_PROVIDER_TIMEOUT_MS") || 8_000));
  try {
    const response = await fetch(url.replace(/\/$/, "") + "/research", {
      method: "POST",
      headers: authHeaders(provider),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 4_000) }; }
    if (!response.ok) return { provider, ok: false, status: response.status, error: "Provider returned " + response.status + "." };
    return { provider, ok: true, status: response.status, data };
  } catch (error) {
    return { provider, ok: false, error: error instanceof Error ? error.message : "Provider request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runExternalResearch(input: ResearchRequest): Promise<ProviderResponse[]> {
  const requests: Array<{ provider: ProviderKind; url: string; payload: Record<string, unknown> }> = [];
  if (urlMap.agent_reach) requests.push({
    provider: "agent_reach",
    url: urlMap.agent_reach,
    payload: { task: input.objective, tenantId: input.tenantId, restaurantName: input.restaurantName, city: input.city },
  });
  if (urlMap.jev) requests.push({
    provider: "jev",
    url: urlMap.jev,
    payload: { goal: input.objective, context: { restaurant: input.restaurantName, city: input.city }, tenantId: input.tenantId },
  });
  if (urlMap.jev_social) requests.push({
    provider: "jev_social",
    url: urlMap.jev_social,
    payload: { query: input.objective, geography: input.city, tenantId: input.tenantId },
  });
  if (urlMap.demand_radar) requests.push({
    provider: "demand_radar",
    url: urlMap.demand_radar,
    payload: { objective: input.objective, geography: input.city, business: input.restaurantName, tenantId: input.tenantId },
  });

  return Promise.all(requests.map((request) => postJson(request.provider, request.url, request.payload)));
}

export async function askNahaLLM(messages: Array<{ role: "system" | "user"; content: string }>) {
  const base = urlMap.nahallm;
  const key = tokenMap.nahallm;
  if (!base || !key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(base.replace(/\/$/, "") + "/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env("NAHALLM_MODEL_ALIAS") || "balanced",
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
