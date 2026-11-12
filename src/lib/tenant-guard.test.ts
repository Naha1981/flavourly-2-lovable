import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const libRoot = __dirname;
const explicitlyPublic = new Set([
  "menu.functions.ts:getPublicMenu",
  "menu.functions.ts:getClaim",
  "menu.functions.ts:redeemClaim",
  // Returns only whether login is required; the login screen needs this before sign-in.
  "workspace.functions.ts:getAuthConfig",
]);

function findFunctionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findFunctionFiles(path);
    return entry.isFile() &&
      (entry.name.endsWith(".functions.ts") || entry.name === "functions.ts")
      ? [path]
      : [];
  });
}

function getServerFunctions(file: string) {
  const source = readFileSync(file, "utf8");
  const modulePath = relative(libRoot, file).split(/[\\/]/).join("/");
  return source.split(/(?=export const \w+ = createServerFn)/).slice(1).map((block) => {
    const name = /export const (\w+)/.exec(block)?.[1] ?? "unknown";
    const [head = "", handler = ""] = block.split(".handler");
    const basename = modulePath.split("/").at(-1) ?? modulePath;
    return {
      name, block, head, handler,
      key: modulePath + ":" + name,
      basenameKey: basename + ":" + name,
      file: modulePath,
    };
  });
}

/**
 * Generate a guard inventory from all root and nested server-function modules.
 * Public functions are explicit constrained exceptions. This is a static guard
 * inventory plus runtime auth-flow tests, not a substitute for live tenant A/B
 * request tests against the service-role database.
 */
describe("tenant isolation guard inventory", () => {
  const files = findFunctionFiles(libRoot);
  const functions = files.flatMap((file) => getServerFunctions(file));

  it("discovers root and nested server-function modules", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(functions.length).toBeGreaterThan(35);
    expect(functions.some((fn) => fn.file.startsWith("intelligence/"))).toBe(true);
  });

  for (const fn of functions) {
    const isPublic = explicitlyPublic.has(fn.key) || explicitlyPublic.has(fn.basenameKey);
    if (isPublic) {
      it(`${fn.key} is an intentional public function with constrained scope`, () => {
        if (fn.name === "getPublicMenu") {
          expect(fn.head).toContain("slug: tenant");
          expect(fn.handler).toContain('.eq("tenant_id", data.slug)');
        } else if (fn.name === "getClaim" || fn.name === "redeemClaim") {
          expect(fn.head).toContain("token: z.string().regex");
          expect(fn.head).toContain("^[a-f0-9]{32}$");
        } else if (fn.name === "getAuthConfig") {
          expect(fn.handler).toContain("authRequired()");
          expect(fn.handler).not.toMatch(/\.from\(|\.insert\(|\.update\(|\.delete\(/);
        }
      });
      continue;
    }

    it(`${fn.key} authenticates the caller before protected work`, () => {
      const hasValidatedInput = /\.(?:inputValidator|validator)\s*\(/.test(fn.block);
      const hasAuthMiddleware = /\.middleware\s*\(\s*\[\s*requireSupabaseAuth\s*\]/.test(fn.block);
      expect(hasValidatedInput || hasAuthMiddleware).toBe(true);
      expect(
        hasAuthMiddleware ||
        /(await\s+\w*(?:guard|authorize|ownerOnly)\w*\(|await\s+requireUser\s*\()/.test(fn.block),
      ).toBe(true);
    });

    if (/tenantId\s*:/.test(fn.head)) {
      it(`${fn.key} authorises the tenant supplied by the request`, () => {
        expect(
          /(?:guard|authorizeTenant|ownerOnly)\(\s*(?:data\.tenantId|tenantId)/.test(fn.block),
        ).toBe(true);
      });
    }
  }
});
