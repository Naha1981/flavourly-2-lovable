import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { ip: string | null } = { ip: null };

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () =>
    state.ip === null
      ? new Request("http://x")
      : new Request("http://x", { headers: { "cf-connecting-ip": state.ip } }),
}));

import { allowRateLimited, resetRateLimitsForTests } from "@/lib/rate-limit.server";

beforeEach(() => {
  resetRateLimitsForTests();
  state.ip = null;
});

describe("allowRateLimited", () => {
  it("allows up to the limit within the window, then refuses", () => {
    state.ip = "1.2.3.4";
    for (let i = 0; i < 3; i++) expect(allowRateLimited("s", 3, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("s", 3, 60_000, 1000)).toBe(false);
    expect(allowRateLimited("s", 3, 60_000, 2000)).toBe(false);
  });

  it("opens a fresh window after the old one expires", () => {
    state.ip = "1.2.3.4";
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(false);
    expect(allowRateLimited("s", 1, 60_000, 61_001)).toBe(true);
  });

  it("tracks source IPs independently", () => {
    state.ip = "1.2.3.4";
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(false);
    state.ip = "5.6.7.8";
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(true);
  });

  it("tracks scopes independently", () => {
    state.ip = "1.2.3.4";
    expect(allowRateLimited("a", 1, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("b", 1, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("a", 1, 60_000, 1000)).toBe(false);
  });

  it("falls back to a shared bucket when no trusted IP header exists", () => {
    state.ip = null;
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(true);
    expect(allowRateLimited("s", 1, 60_000, 1000)).toBe(false);
  });
});
