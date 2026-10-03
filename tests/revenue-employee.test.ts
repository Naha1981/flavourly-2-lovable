import { describe, expect, it, vi } from "vitest";

describe("Revenue Employee provider routing", () => {
  it("does not claim providers are configured when environment is empty", async () => {
    vi.stubEnv("NAHALLM_BASE_URL", "");
    vi.stubEnv("AGENT_REACH_URL", "");
    vi.stubEnv("JEV_URL", "");
    vi.stubEnv("JEV_SOCIAL_URL", "");
    vi.stubEnv("DEMAND_RADAR_URL", "");

    const { providerStatuses } = await import("../src/lib/intelligence/providers.server");
    const statuses = providerStatuses();

    expect(statuses.find((provider) => provider.provider === "nahallm")?.configured).toBe(false);
    expect(statuses.find((provider) => provider.provider === "jev")?.configured).toBe(false);
    expect(statuses.find((provider) => provider.provider === "demand_radar")?.configured).toBe(false);
  });
});

describe("Revenue Employee evidence contract", () => {
  it("uses explicit evidence states", async () => {
    const evidence: import("../src/lib/intelligence/types").EvidenceState = "VERIFIED";
    expect(["VERIFIED", "INFERRED", "ESTIMATED", "UNKNOWN"]).toContain(evidence);
  });
});
