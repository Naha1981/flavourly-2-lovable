import { describe, expect, it } from "vitest";
import { assignVariant } from "../src/lib/campaigns";

describe("assignVariant", () => {
  it("always returns 'a' when there is no variant B", () => {
    for (const p of ["27821112233", "27831234567", "27849876543"])
      expect(assignVariant(p, false)).toBe("a");
  });
  it("splits a spread of phone numbers roughly 50/50", () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 500; i++) counts[assignVariant(`2782${1_000_000 + i}`, true)] += 1;
    expect(counts.a).toBeGreaterThan(150);
    expect(counts.b).toBeGreaterThan(150);
  });
  it("is deterministic for the same phone", () => {
    expect(assignVariant("27821112233", true)).toBe(assignVariant("27821112233", true));
  });
});
