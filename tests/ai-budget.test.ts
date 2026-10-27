import { beforeEach, describe, expect, it, vi } from "vitest";

const alerts: { key: string; level: string }[] = [];
vi.mock("@/lib/alerts.server", () => ({
  sendAlert: async (key: string, level: string) => {
    alerts.push({ key, level });
    return { delivered: "sent" as const, outcomes: [] };
  },
}));

import { AiBudgetExceeded, assertAiBudget } from "@/lib/ai-budget.server";

function mockRpc(calls: number | null, error: string | null = null) {
  return {
    rpc: async (_fn: string, _args: Record<string, unknown>) =>
      error
        ? { data: null, error: { message: error } }
        : { data: calls, error: null },
  };
}

beforeEach(() => {
  alerts.length = 0;
  delete process.env["FLAVOURLY_AI_DAILY_CALLS_PER_TENANT"];
});

describe("assertAiBudget", () => {
  it("allows calls under the daily cap", async () => {
    await expect(assertAiBudget("t-1", "test", mockRpc(1) as never)).resolves.toBeUndefined();
    await expect(assertAiBudget("t-1", "test", mockRpc(200) as never)).resolves.toBeUndefined();
  });

  it("refuses the call past the cap and alerts the owner once per crossing", async () => {
    await expect(assertAiBudget("t-1", "gemini-live-tool:x", mockRpc(201) as never)).rejects.toBeInstanceOf(
      AiBudgetExceeded,
    );
    expect(alerts).toEqual([{ key: "ai-budget:t-1", level: "warning" }]);
  });

  it("honours the env-configured cap", async () => {
    process.env["FLAVOURLY_AI_DAILY_CALLS_PER_TENANT"] = "5";
    await expect(assertAiBudget("t-1", "test", mockRpc(5) as never)).resolves.toBeUndefined();
    await expect(assertAiBudget("t-1", "test", mockRpc(6) as never)).rejects.toBeInstanceOf(AiBudgetExceeded);
  });

  it("fails open (with a logged error) when metering itself breaks", async () => {
    await expect(assertAiBudget("t-1", "test", mockRpc(null, "relation ai_usage_counters does not exist") as never)).resolves.toBeUndefined();
    expect(alerts).toEqual([]);
  });
});
