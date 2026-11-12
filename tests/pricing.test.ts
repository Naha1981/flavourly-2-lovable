import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plans, TRIAL_DAYS, MESSAGE_USAGE_FEE_NOTICE } from "@/lib/pricing";

describe("approved public launch offer", () => {
  it("has only the three approved prices and a seven-day trial", () => {
    expect(plans.map((p) => p.price)).toEqual([999, 1500, 2900]);
    expect(TRIAL_DAYS).toBe(7);
  });
  it("keeps higher plans conditional and all plans single-venue", () => {
    expect(plans.every((p) => p.features.includes("One venue and one WhatsApp number"))).toBe(true);
    expect(plans.slice(1).every((p) => p.highlight.includes("after pilot acceptance"))).toBe(true);
  });
});

describe("messaging usage disclosure", () => {
  it("states separate usage billing without naming a provider", () => {
    expect(MESSAGE_USAGE_FEE_NOTICE).toContain("includes a monthly volume");
    expect(MESSAGE_USAGE_FEE_NOTICE).toContain("Additional messaging may carry usage charges");
    expect(MESSAGE_USAGE_FEE_NOTICE).toContain("agreed before activation");
    expect(MESSAGE_USAGE_FEE_NOTICE).not.toMatch(/meta|zernio|payfast|lovable/i);
  });
});

it("shows the same usage notice on pricing, terms and the billing screen", () => {
  for (const file of ["pricing.tsx", "legal.terms.tsx", "dashboard.billing.tsx"]) {
    expect(readFileSync(new URL("../src/routes/" + file, import.meta.url), "utf8")).toContain(
      "MESSAGE_USAGE_FEE_NOTICE",
    );
  }
});
