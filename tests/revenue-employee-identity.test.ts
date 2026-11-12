import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const actorState = vi.hoisted(() => ({ id: "authenticated-user-123" }));
vi.mock("@/lib/tenant-auth.server", () => ({
  actorId: async () => actorState.id,
}));

describe("Revenue Employee approval identity", () => {
  afterEach(() => { actorState.id = "authenticated-user-123"; });

  it("uses the authenticated server actor and rejects missing identity", async () => {
    const { requireApprovalActorId } = await import("@/lib/intelligence/functions");
    expect(await requireApprovalActorId()).toBe("authenticated-user-123");

    actorState.id = null as unknown as string;
    await expect(requireApprovalActorId()).rejects.toMatchObject({ status: 401 });
  });

  it("does not accept approvedBy from client input", () => {
    const source = readFileSync(new URL("../src/lib/intelligence/functions.ts", import.meta.url), "utf8");
    const block = source.slice(source.indexOf("export const approveRevenueActionFn"));
    expect(block).not.toMatch(/approvedBy:\s*z\./);
    expect(block).toContain("requireApprovalActorId()");
    expect(block).toContain("approveRevenueAction({ ...data, approvedBy })");
  });
});
