import { beforeEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ error: null as unknown, data: null as unknown }));
vi.mock("../src/lib/db.server", () => ({
  db: async () => ({ rpc: async () => ({ data: state.data, error: state.error }) }),
}));
vi.mock("../src/lib/tenant-auth.server", () => ({
  authorizeTenant: vi.fn(),
  actorId: async () => "synthetic-owner",
}));
import { exportWorkspaceData } from "../src/lib/privacy.server";
beforeEach(() => {
  state.error = null;
  state.data = null;
});
describe("safe privacy failure reference", () => {
  it("shows only an allowed error code, never raw database details", async () => {
    state.error = { code: "PGRST202", message: "secret internal database host", hint: "private" };
    await expect(exportWorkspaceData("synthetic-a")).rejects.toThrow("Reference: PGRST202");
    try {
      await exportWorkspaceData("synthetic-a");
    } catch (e) {
      expect(String(e)).not.toContain("secret");
    }
  });
  it("does not treat an empty RPC response as a download", async () => {
    await expect(exportWorkspaceData("synthetic-a")).rejects.toThrow(
      "No partial download was created. Reference: EMPTY_RESULT",
    );
  });
});
