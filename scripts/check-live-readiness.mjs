/** Read-only public acceptance probe. No auth/session, secrets or writes. */
const site = new URL(process.argv[2] || "https://flavourly-2-lovable.lovable.app/");
if (site.protocol !== "https:") throw new Error("Use the exact HTTPS deployment URL.");
const read = async (url, headers = {}) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  return { status: response.status, text: await response.text() };
};
const checkedAt = new Date().toISOString();
const home = await read(site);
const scripts = [...home.text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(
  (m) => new URL(m[1], site),
);
const main = scripts.find(
  (u) => u.origin === site.origin && /\/assets\/index-[^/]+\.js$/.test(u.pathname),
);
if (!main) throw new Error("Could not identify the current same-origin frontend bundle.");
const bundle = await read(main);
const authBase = bundle.text.match(/VITE_SUPABASE_URL:[`"']([^`"']+)/)?.[1];
const publicKey = bundle.text.match(/VITE_SUPABASE_PUBLISHABLE_KEY:[`"']([^`"']+)/)?.[1];
if (!authBase || !publicKey?.startsWith("sb_publishable_"))
  throw new Error("Public auth config was not verified; no auth probe performed.");
const authUrl = new URL("/auth/v1/settings", authBase);
if (authUrl.protocol !== "https:" || !authUrl.hostname.endsWith(".lovable.cloud"))
  throw new Error("Unexpected auth host; review before probing.");
const [health, settings] = await Promise.all([
  read(new URL("/api/health", site)),
  read(authUrl, { apikey: publicKey }),
]);
const parse = (x) => {
  try {
    return JSON.parse(x.text);
  } catch {
    return null;
  }
};
const h = parse(health),
  a = parse(settings);
const result = {
  checkedAt,
  site: site.origin,
  readOnly: true,
  frontend: { status: home.status, bundle: main.href },
  health: { status: health.status, report: h },
  emailAuth: {
    source: authUrl.href,
    status: settings.status,
    enabled: a?.external?.email === true,
    signupDisabled: a?.disable_signup ?? null,
    confirmationRequired: a ? a.mailer_autoconfirm === false : null,
  },
  limitations: [
    "No signup, login, send, booking, SQL or payment attempted.",
    "Public readiness is not authenticated workflow acceptance.",
  ],
};
console.log(JSON.stringify(result, null, 2));
if (
  home.status !== 200 ||
  health.status !== 200 ||
  h?.status !== "ok" ||
  a?.external?.email !== true ||
  a?.disable_signup !== false
)
  process.exitCode = 1;
