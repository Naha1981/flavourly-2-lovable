import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function trackedFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return []; // not a git checkout (e.g. a source tarball)
  }
}

const SKIP = /(^|\/)(bun\.lock|package-lock\.json|.*\.(png|jpe?g|gif|webp|ico|woff2?|pdf|svg))$/i;

const PATTERNS: Array<[string, RegExp]> = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["OpenAI/OpenRouter style key", /\bsk-(?:or-)?[A-Za-z0-9_-]{32,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}/],
];

function isServiceRoleJwt(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

describe("repository secrets", () => {
  const files = trackedFiles().filter((f) => !SKIP.test(f));

  it("has no credentials committed to tracked files", () => {
    const hits: string[] = [];
    for (const file of files) {
      let text: string;
      try {
        text = readFileSync(join(root, file), "utf8");
      } catch {
        continue;
      }
      for (const [label, pattern] of PATTERNS) if (pattern.test(text)) hits.push(`${file}: ${label}`);
      for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
        if (isServiceRoleJwt(token)) hits.push(`${file}: Supabase service_role JWT`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps .env limited to public client configuration", () => {
    if (!files.includes(".env")) return;
    const names = [...readFileSync(join(root, ".env"), "utf8").matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] as string);
    const allowed = /^(VITE_.*|SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_PROJECT_ID)$/;
    expect(names.filter((n) => !allowed.test(n))).toEqual([]);
  });
});
