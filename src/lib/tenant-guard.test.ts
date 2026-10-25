import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const libRoot = __dirname;
const explicitlyPublic = new Set([
  "menu.functions.ts:getPublicMenu",
  "menu.functions.ts:getClaim",
  "menu.functions.ts:redeemClaim",
]);

function findFunctionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findFunctionFiles(path);
    return entry.isFile() && entry.name.endsWith(".functions.ts") ? [path] : [];
  });
}

function getServerFunctions(file: string) {
  const source = readFileSync(file, "utf8");
  return source.split(/(?=export const \w+ = createServerFn)/).slice(1).map((block) => {
    const name = /export const (\w+)/.exec(block)?.[1] ?? "unknown";
    const [head = "", handler = ""] = block.split(".handler");
    const firstPath = relative(libRoot, file).split(/[\\/]/).at(-1) ?? file;
    return { name, block, head, handler, key: firstPath + ":" + name, file: relative(libRoot, file) };
  });
}

/**
 * Build the guard checklist from the repository's exported server-function list.
 * Public menu/claim lookups are explicit exceptions, not silently skipped because
 * their input does not contain tenantId. A separate auth-flow test verifies the
 * shared auth boundary returns 401/403 for missing membership.
 */
describe("tenant isolation guard inventory", () => {
  const files = findFunctionFiles(libRoot);
  const functions = files.flatMap((file) => getServerFunctions(file));

  it("discovers the root and nested server-function modules", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(functions.length).toBeGreaterThan(35);
    expect(functions.some((fn) => fn.file.startsWith("intelligence/"))).toBe(true);
  });

  for (const fn of functions) {
    if (explicitlyPublic.has(fn.key)) {
      it(`${fn.key} is an intentional public lookup with constrained input`, () => {
        expect(fn.head).toContain(".inputValidator");
        if (fn.name === "getPublicMenu") {
          expect(fn.head).toContain("slug: tenant");
          expect(fn.handler).toContain('.eq("tenant_id", data.slug)');
        } else {
          expect(fn.head).toContain("token: z.string().regex");
          expect(fn.head).toContain("^[a-f0-9]{32}$");
        }
      });
      continue;
    }

    it(`${fn.key} authenticates the caller before protected work`, () => {
      expect(fn.head).toContain(".inputValidator");
      expect(
        /(await\s+\w*(?:guard|authorize|ownerOnly)\w*\(|await\s+requireUser\s*\()/.test(fn.handler),
      ).toBe(true);
    });

    if (/tenantId\s*:/.test(fn.head)) {
      it(`${fn.key} passes the request tenant to its authorization guard`, () => {
        expect(
          /(?:guard|authorizeTenant|ownerOnly)\(\s*data\.tenantId/.test(fn.handler),
        ).toBe(true);
      });
    }
  }
});
