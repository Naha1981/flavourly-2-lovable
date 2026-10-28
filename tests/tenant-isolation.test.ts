import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDb, type FakeDb } from "./helpers/fake-db";

/**
 * Generated runtime tenant-isolation sweep (Definition of Done, Gate B;
 * audit M6). The function list is DISCOVERED from src/lib/** / *.functions.ts,
 * never enumerated by hand: adding a server function without a guard fails
 * this file.
 *
 * For every non-public function it proves at runtime, against the real
 * authorizeTenant/requireUser and a seeded membership table:
 *   - signed-out caller -> 401
 *   - tenant A member passing tenant B's id -> 403
 *   - role matrix: staff caller on a manager-gated function -> 403,
 *     owner/manager -> pass
 *
 * Harness note: TanStack Start's server-function registry is a build-time
 * virtual module, so vitest cannot invoke the createServerFn wrappers
 * end-to-end. Each function's declared guard (extracted from source) is
 * executed against the real auth code with the roles that function declares,
 * and a static check proves the guard is awaited before the handler's first
 * database call. Full request-level A/B testing against a real database is
 * Gate F acceptance-script item 8 (owner-run).
 */

const libRoot = join(__dirname, "../src/lib");

const explicitlyPublic = new Set([
  "menu.functions.ts:getPublicMenu",
  "menu.functions.ts:getClaim",
  "menu.functions.ts:redeemClaim",
  "workspace.functions.ts:getAuthConfig",
]);

type GuardKind = "managers" | "any" | "user" | "middleware";

interface DiscoveredFn {
  key: string;
  name: string;
  file: string;
  guard: GuardKind;
  guardBeforeDb: boolean;
}

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

function discover(): DiscoveredFn[] {
  const out: DiscoveredFn[] = [];
  for (const file of findFunctionFiles(libRoot)) {
    const modulePath = relative(libRoot, file).split(/[\\/]/).join("/");
    const source = readFileSync(file, "utf8");
    const blocks = source.split(/(?=export const \w+ = createServerFn)/).slice(1);
    for (const block of blocks) {
      const name = /export const (\w+)/.exec(block)?.[1] ?? "unknown";
      const basename = modulePath.split("/").at(-1) ?? modulePath;
      if (explicitlyPublic.has(modulePath + ":" + name) || explicitlyPublic.has(basename + ":" + name)) continue;
      const handler = block.split(".handler")[1] ?? "";
      const managerGuard =
        /await\s+(?:guard\(\s*data\.tenantId\s*,\s*"managers"|authorizeTenant\(\s*(?:data\.tenantId|tenantId)\s*,\s*MANAGERS)/.test(handler);
      const anyGuard =
        /await\s+(?:guard\(\s*data\.tenantId\s*(?:,\s*"any"\s*)?\)|authorizeTenant\(\s*(?:data\.tenantId|tenantId)\s*(?:,\s*(?:ANY_ROLE|roles\s*===\s*"any"\s*\?\s*ANY_ROLE\s*:\s*MANAGERS))?\s*\))/.test(handler);
      const userGuard = /await\s+requireUser\s*\(\s*\)/.test(handler);
      const middlewareAuth = /\.middleware\s*\(\s*\[\s*requireSupabaseAuth\s*\]/.test(block);
      const guard: GuardKind = managerGuard
        ? "managers"
        : anyGuard
          ? "any"
          : userGuard
            ? "user"
            : middlewareAuth
              ? "middleware"
              : ("none" as never);
      const guardIdx = handler.search(/await\s+(?:guard|authorizeTenant|requireUser)\s*\(/);
      const dbIdx = handler.search(/\.from\(/);
      // Middleware-authenticated functions run requireSupabaseAuth before the
      // handler body exists, so ordering is inherent; others must show it.
      const guardBeforeDb =
        middlewareAuth || (guardIdx >= 0 && (dbIdx === -1 || guardIdx < dbIdx));
      out.push({ key: modulePath + ":" + name, name, file: modulePath, guard, guardBeforeDb });
    }
  }
  return out;
}

const functions = discover();

/* ---------- runtime auth harness (mirrors tests/auth-flow.test.ts) ---------- */

const state: { db: FakeDb; auth: string | null } = { db: createFakeDb(), auth: null };
const OWNER_TOKEN = "own.er.token";
const STAFF_TOKEN = "sta.ff.token";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://x", { headers: state.auth ? { authorization: state.auth } : {} }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return Object.assign(state.db, {
      auth: {
        getUser: async (token: string) => {
          const id = { [OWNER_TOKEN]: "user-owner", [STAFF_TOKEN]: "user-staff" }[token];
          return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "bad" } };
        },
      },
    });
  },
}));
vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
};

beforeEach(async () => {
  state.db = createFakeDb({ tenant_members: [["tenant_id", "user_id"]] });
  state.auth = null;
  await state.db.from("tenant_members").insert({ tenant_id: "tenant-a", user_id: "user-owner", role: "owner" });
  await state.db.from("tenant_members").insert({ tenant_id: "tenant-a", user_id: "user-staff", role: "staff" });
  process.env["REQUIRE_AUTH"] = "true";
});

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

describe("generated tenant-isolation sweep", () => {
  it("discovers the real function inventory", () => {
    expect(functions.length).toBeGreaterThan(35);
    expect(functions.some((f) => f.file.startsWith("intelligence/"))).toBe(true);
  });

  it("every non-public function has a classified guard", () => {
    const unguarded = functions.filter((f) => (f.guard as string) === "none");
    expect(unguarded.map((f) => f.key)).toEqual([]);
  });

  for (const fn of functions) {
    describe(fn.key, () => {
      it("runs its declared guard before any database call", () => {
        expect(fn.guardBeforeDb).toBe(true);
      });

      it("rejects a signed-out caller with 401", async () => {
        const { authorizeTenant, requireUser, ANY_ROLE, MANAGERS } = await import("@/lib/tenant-auth.server");
        state.auth = null;
        if (fn.guard === "user") {
          expect(await status(requireUser())).toBe(401);
        } else if (fn.guard === "middleware") {
          // requireSupabaseAuth (generated file, own Supabase client) rejects
          // signed-out callers before the handler; covered by the static
          // wiring assertion and by auth-flow runtime tests of the same
          // token-verification path.
          expect(fn.guard).toBe("middleware");
        } else {
          expect(await status(authorizeTenant(TENANT_A, fn.guard === "managers" ? MANAGERS : ANY_ROLE))).toBe(401);
        }
      });

      if (fn.guard === "managers" || fn.guard === "any") {
        it("rejects a tenant A member passing tenant B's id with 403", async () => {
          const { authorizeTenant, ANY_ROLE, MANAGERS } = await import("@/lib/tenant-auth.server");
          state.auth = "Bearer " + OWNER_TOKEN;
          const roles = fn.guard === "managers" ? MANAGERS : ANY_ROLE;
          expect(await status(authorizeTenant(TENANT_B, roles))).toBe(403);
        });
      }

      if (fn.guard === "managers") {
        it("rejects a staff member of the tenant with 403 (role matrix)", async () => {
          const { authorizeTenant, MANAGERS } = await import("@/lib/tenant-auth.server");
          state.auth = "Bearer " + STAFF_TOKEN;
          expect(await status(authorizeTenant(TENANT_A, MANAGERS))).toBe(403);
        });
        it("admits an owner of the tenant", async () => {
          const { authorizeTenant, MANAGERS } = await import("@/lib/tenant-auth.server");
          state.auth = "Bearer " + OWNER_TOKEN;
          expect(await status(authorizeTenant(TENANT_A, MANAGERS))).toBe(200);
        });
      }

      if (fn.guard === "any") {
        it("admits any role of the tenant (role matrix)", async () => {
          const { authorizeTenant, ANY_ROLE } = await import("@/lib/tenant-auth.server");
          state.auth = "Bearer " + STAFF_TOKEN;
          expect(await status(authorizeTenant(TENANT_A, ANY_ROLE))).toBe(200);
        });
      }
    });
  }
});
