import { describe, expect, it } from "vitest";
import { plans, TRIAL_DAYS } from "@/lib/pricing";

describe("approved public launch offer", () => {
  it("has only the three approved prices and a seven-day trial", () => {
    expect(plans.map(p => p.price)).toEqual([999, 1499, 2900]);
    expect(TRIAL_DAYS).toBe(7);
  });
  it("keeps higher plans conditional and all plans single-venue", () => {
    expect(plans.every(p => p.features.includes("One venue and one WhatsApp number"))).toBe(true);
    expect(plans.slice(1).every(p => p.highlight.includes("after pilot acceptance"))).toBe(true);
  });
});
