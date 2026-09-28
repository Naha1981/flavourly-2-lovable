import { describe, expect, it } from "vitest";
import { classifyMenu } from "../src/lib/menu-matrix";

const item = (id: string, price: number, cost: number | null, sales: number) => ({
  id,
  name: id,
  priceCents: price,
  costPriceCents: cost,
  salesCount30d: sales,
  isAvailable: true,
});

describe("classifyMenu", () => {
  it("handles an empty menu", () => {
    expect(classifyMenu([]).items).toEqual([]);
  });
  it("makes a single-item menu a Star", () => {
    expect(classifyMenu([item("a", 10000, 3000, 5)]).items[0]!.cls).toBe("STAR");
  });
  it("places items in the four quadrants", () => {
    const s = classifyMenu([
      item("star", 20000, 5000, 100),
      item("plow", 10000, 8000, 100),
      item("puzzle", 30000, 6000, 5),
      item("dog", 9000, 8000, 5),
    ]);
    const by = Object.fromEntries(s.items.map((i) => [i.id, i.cls]));
    expect(by).toEqual({ star: "STAR", plow: "PLOWHORSE", puzzle: "PUZZLE", dog: "DOG" });
  });
  it("flags estimated costs and handles zero price without NaN", () => {
    const s = classifyMenu([item("free", 0, null, 3), item("x", 10000, 0, 3)]);
    expect(s.missingCostCount).toBe(1);
    expect(s.items[0]!.marginPct).toBe(0);
    expect(s.items[1]!.marginPct).toBe(100);
  });
});
