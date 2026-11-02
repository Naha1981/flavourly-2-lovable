import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./helpers/fake-db";
const state: { db: FakeDb; user: string | null } = { db: createFakeDb(), user: null };
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    new Request("http://local", {
      headers: state.user ? { authorization: "Bearer qa.session.token" } : {},
    }),
}));
vi.mock("@/lib/db.server", () => ({ db: async () => state.db }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return {
      auth: {
        getUser: async () => ({
          data: { user: state.user ? { id: state.user } : null },
          error: null,
        }),
      },
    };
  },
}));
beforeEach(() => {
  state.db = createFakeDb({
    tenant_profiles: [["tenant_id"]],
    tenant_members: [["tenant_id", "user_id"]],
  });
  state.user = "synthetic-user-a";
});
describe("synthetic workspace and actual guard journey, not live acceptance", () => {
  it("creates clean separate workspaces, saves and restores the returning owner's profile", async () => {
    const { ensureWorkspace } = await import("@/lib/workspace.server");
    const a = await ensureWorkspace(state.db as never, state.user!, "Synthetic restaurant");
    expect(state.db.rows("menu_items")).toEqual([]);
    expect(state.db.rows("customers")).toEqual([]);
    await state.db
      .from("tenant_profiles")
      .update({ name: "Synthetic saved restaurant", hours: "09:00-17:00", city: "Synthetic city" })
      .eq("tenant_id", a.tenantId);
    const { authorizeTenant } = await import("@/lib/tenant-auth.server");
    state.user = null;
    await expect(authorizeTenant(a.tenantId)).rejects.toMatchObject({ status: 401 });
    state.user = "synthetic-user-a";
    await expect(authorizeTenant(a.tenantId)).resolves.toBeUndefined();
    const returning = await ensureWorkspace(
      state.db as never,
      state.user,
      "Changed login metadata",
    );
    expect(returning.tenantId).toBe(a.tenantId);
    state.user = "synthetic-user-b";
    const b = await ensureWorkspace(state.db as never, state.user, "Synthetic restaurant");
    expect(b.tenantId).not.toBe(a.tenantId);
    expect(
      state.db.rows("tenant_profiles").find((r) => r["tenant_id"] === b.tenantId)?.["city"],
    ).toBeUndefined();
    await expect(authorizeTenant(a.tenantId)).rejects.toMatchObject({ status: 403 });
    state.user = "synthetic-user-a";
    expect(await ensureWorkspace(state.db as never, state.user, "Ignored metadata")).toMatchObject({
      name: "Synthetic saved restaurant",
      tenantId: a.tenantId,
    });
    expect(state.db.rows("tenant_profiles")).toHaveLength(2);
  });
});
