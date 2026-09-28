import { describe, expect, it } from "vitest";
import {
  discountCentsForPoints,
  formatZAR,
  haversineMeters,
  pointsForSpend,
} from "../src/lib/south-africa";

describe("loyalty maths", () => {
  it("R250.50 earns 250 points, never rounds up", () => {
    expect(pointsForSpend(25050)).toBe(250);
    expect(pointsForSpend(99)).toBe(0);
  });
  it("100 points = R10", () => {
    expect(discountCentsForPoints(100)).toBe(1000);
    expect(discountCentsForPoints(300)).toBe(3000);
  });
});

describe("formatZAR", () => {
  it("formats whole and fractional rand", () => {
    expect(formatZAR(15000)).toBe("R150");
    expect(formatZAR(15050)).toBe("R150.50");
  });
});

describe("haversineMeters", () => {
  it("is ~0 at the same point and separates on-site from off-site", () => {
    expect(haversineMeters(-26.1, 28.0, -26.1, 28.0)).toBe(0);
    expect(haversineMeters(-33.9513, 18.3781, -33.9504, 18.3773)).toBeLessThan(500);
    expect(haversineMeters(-33.9513, 18.3781, -33.8943, 18.6294)).toBeGreaterThan(20000);
  });
});
