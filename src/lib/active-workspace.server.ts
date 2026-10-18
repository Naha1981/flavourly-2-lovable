import { getRequest } from "@tanstack/react-start/server";

export const WORKSPACE_COOKIE = "nl_workspace";

/** The workspace the user picked in the switcher. Always checked against their memberships before use. */
export function requestedTenant(): string | null {
  const raw = getRequest()?.headers.get("cookie") ?? "";
  const part = raw.split(/;\s*/).find((p) => p.startsWith(WORKSPACE_COOKIE + "="));
  const v = part ? decodeURIComponent(part.slice(WORKSPACE_COOKIE.length + 1)) : "";
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(v) ? v : null;
}

export function pickTenant<T extends { tenant_id: unknown }>(rows: T[] | null | undefined): T | null {
  if (!rows?.length) return null;
  const want = requestedTenant();
  return rows.find((r) => String(r.tenant_id) === want) ?? rows[0] ?? null;
}
