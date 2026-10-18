const COOKIE = "nl_workspace";

export function activeWorkspaceId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split(/;\s*/).find((p) => p.startsWith(COOKIE + "="));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}

export function setActiveWorkspace(id: string) {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
}

export const inviteUrl = (token: string) => `${location.origin}/join/${token}`;
