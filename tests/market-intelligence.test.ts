import { describe, expect, it } from "vitest";

import { compareMenus, pricePosition } from "@/lib/market-intelligence";

describe("market intelligence", () => {
  it("compares menus deterministically", () => {
    const result = compareMenus(
      [{ name: "Butter Chicken" }, { name: "Fries" }, { name: "Malva Pudding" }],
      [{ name: "butter chicken" }, { name: "Fries" }, { name: "Cheesecake" }],
    );
    expect(result.matched).toEqual(["Butter Chicken", "Fries"]);
    expect(result.onlyRestaurant).toEqual(["Malva Pudding"]);
    expect(result.onlyCompetitor).toEqual(["Cheesecake"]);
    expect(result.overlapPercent).toBe(50);
  });

  it("calculates median price positioning", () => {
    expect(pricePosition(16000, [14000, 15000, 18000])).toEqual({
      medianCents: 15000,
      deltaPercent: 6.7,
    });
  });
});
