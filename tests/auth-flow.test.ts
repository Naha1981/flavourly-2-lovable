import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postLoginPath, signInErrorMessage, validateSignup } from "@/lib/auth-rules";
import { createFakeDb, type FakeDb } from "./helpers/fake-db";

/** Sign-up, sign-in, restaurant creation on first sign-in, and dashboard protection. */
const state: { db: FakeDb; auth: string | null; users: Record<string, string> } = {
  db: createFakeDb(),
  auth: null,
  users: {},
};

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://x", { headers: state.auth ? { authorization: state.auth } : {} }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return Object.assign(state.db, {
      auth: {
        getUser: async (token: string) => {
          const id = state.users[token];
          return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: { message: "bad" } };
        },
      },
    });
  },
}));

const TOKEN = "aaa.bbb.ccc";

beforeEach(() => {
  state.db = createFakeDb({ tenant_profiles: [["tenant_id"]], tenant_members: [["tenant_id", "user_id"]] });
  state.auth = null;
  state.users = { [TOKEN]: "user-1" };
  process.env["REQUIRE_AUTH"] = "true";
});
afterEach(() => {
  delete process.env["REQUIRE_AUTH"];
});

describe("sign-up", () => {
  it("requires a restaurant, an email and an 8+ character password", () => {
    expect(validateSignup({ restaurant: "", email: "a@b.co", password: "12345678" })).not.toBeNull();
    expect(validateSignup({ restaurant: "Marble", email: "a@b.co", password: "1234567" })).not.toBeNull();
    expect(validateSignup({ restaurant: "Marble", email: "not-an-email", password: "12345678" })).not.toBeNull();
    expect(validateSignup({ restaurant: "Marble", email: "a@b.co", password: "12345678" })).toBeNull();
  });
});

describe("sign-in", () => {
  it("returns to the requested dashboard page", () => {
    expect(postLoginPath("/dashboard/inbox")).toBe("/dashboard/inbox");
  });
  it("never redirects outside the dashboard after sign-in", () => {
    expect(postLoginPath(undefined)).toBe("/dashboard");
    expect(postLoginPath("https://evil.example")).toBe("/dashboard");
    expect(postLoginPath("/dashboardx")).toBe("/dashboard");
    expect(postLoginPath("/pricing")).toBe("/dashboard");
  });
  it("explains an unconfirmed email separately from a wrong password", () => {
    expect(signInErrorMessage("Email not confirmed")).toBe("Confirm your email first, then sign in.");
    expect(signInErrorMessage("Invalid login credentials")).toBe("That email and password don't match.");
  });
});

describe("restaurant creation during onboarding", () => {
  it("creates the restaurant and makes the new user its owner", async () => {
    const { ensureWorkspace } = await import("@/lib/workspace.server");
    const ws = await ensureWorkspace(state.db, "user-1", "Marble JHB");
    expect(ws).toEqual({ tenantId: "marble-jhb", name: "Marble JHB", role: "owner" });
    expect(state.db.rows("tenant_members")).toEqual([
      expect.objectContaining({ tenant_id: "marble-jhb", user_id: "user-1", role: "owner" }),
    ]);
  });

  it("is safe to call twice and never creates a second restaurant", async () => {
    const { ensureWorkspace } = await import("@/lib/workspace.server");
    await ensureWorkspace(state.db, "user-1", "Marble JHB");
    const again = await ensureWorkspace(state.db, "user-1", "Something Else");
    expect(again.tenantId).toBe("marble-jhb");
    expect(state.db.rows("tenant_profiles")).toHaveLength(1);
  });

  it("gives a second restaurant with the same name its own address", async () => {
    const { ensureWorkspace } = await import("@/lib/workspace.server");
    await ensureWorkspace(state.db, "user-1", "Marble JHB");
    const other = await ensureWorkspace(state.db, "user-2", "Marble JHB");
    expect(other.tenantId).not.toBe("marble-jhb");
    expect(other.tenantId.startsWith("marble-jhb-")).toBe(true);
  });
});

describe("protected dashboard access", () => {
  const status = async (p: Promise<unknown>) => {
    try {
      await p;
      return 200;
    } catch (e) {
      return (e as Response).status;
    }
  };

  it("fails closed when no authentication environment flags are set", async () => {
    delete process.env["REQUIRE_AUTH"];
    delete process.env["ALLOW_INSECURE_DEMO"];
    delete process.env["PUBLIC_APP_URL"];

    const { authRequired, authorizeTenant } = await import("@/lib/tenant-auth.server");
    expect(authRequired()).toBe(true);
    expect(await status(authorizeTenant("marble-jhb"))).toBe(401);
  });


  it("blocks signed-out visitors with 401", async () => {
    const { authorizeTenant, requireUser } = await import("@/lib/tenant-auth.server");
    expect(await status(requireUser())).toBe(401);
    expect(await status(authorizeTenant("marble-jhb"))).toBe(401);
  });

  it("blocks an invalid session token with 401", async () => {
    state.auth = "Bearer xxx.yyy.zzz";
    const { requireUser } = await import("@/lib/tenant-auth.server");
    expect(await status(requireUser())).toBe(401);
  });

  it("blocks a signed-in user from another restaurant with 403", async () => {
    state.auth = `Bearer ${TOKEN}`;
    state.db.rows("tenant_members").push({ tenant_id: "other", user_id: "user-1", role: "owner" });
    const { authorizeTenant } = await import("@/lib/tenant-auth.server");
    expect(await status(authorizeTenant("marble-jhb"))).toBe(403);
  });

  it("lets staff in but keeps manager-only areas for owners and managers", async () => {
    state.auth = `Bearer ${TOKEN}`;
    state.db.rows("tenant_members").push({ tenant_id: "marble-jhb", user_id: "user-1", role: "staff" });
    const { authorizeTenant, MANAGERS } = await import("@/lib/tenant-auth.server");
    expect(await status(authorizeTenant("marble-jhb"))).toBe(200);
    expect(await status(authorizeTenant("marble-jhb", MANAGERS))).toBe(403);
  });
});
