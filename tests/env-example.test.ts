import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const IGNORED = new Set(["NODE_ENV", "DEV", "PROD", "MODE", "SSR", "BASE_URL"]);

describe(".env.example", () => {
  const example = readFileSync(join(root, ".env.example"), "utf8");
  const declared = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));

  it("documents every environment variable the code reads", () => {
    const used = new Set<string>();
    const pattern = /process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]|process\.env\.([A-Z0-9_]+)|\benv\(\s*["']([A-Z0-9_]+)["']\s*\)|import\.meta\.env\.([A-Z0-9_]+)/g;
    for (const file of sourceFiles(join(root, "src"))) {
      if (file.endsWith(".test.ts")) continue;
      for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
        const name = match.slice(1).find(Boolean);
        if (name && !IGNORED.has(name)) used.add(name);
      }
    }
    const missing = [...used].filter((name) => !declared.has(name)).sort();
    expect(missing, `Add these to .env.example: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not declare the same variable twice (the later empty one silently wins in dotenv)", () => {
    const names = [...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]);
    const dupes = names.filter((name, i) => names.indexOf(name) !== i);
    expect(dupes).toEqual([]);
  });

  it("contains no real secrets (only publishable/public keys may have values)", () => {
    const withValues = [...example.matchAll(/^([A-Z][A-Z0-9_]+)=["']?([^"'\n]+)/gm)].map((m) => [m[1], m[2]] as const);
    const secretish = withValues.filter(([name]) => /SECRET|SERVICE_ROLE|PASSPHRASE|API_KEY|API_TOKEN|MERCHANT_KEY|_TOKEN/.test(name));
    expect(secretish).toEqual([]);
  });
});
