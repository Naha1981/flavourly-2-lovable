import { describe, expect, it } from "vitest";

function birthdayWindow(birthday: string, now: Date): number | null {
  if (!/^\d{2}-\d{2}$/.test(birthday)) return null;
  const [month, day] = birthday.split("-").map(Number) as [number, number];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  const days = Math.floor((target.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= 7 ? days : null;
}

describe("customer lifecycle rules", () => {
  it("recognises birthdays inside the seven-day window", () => {
    expect(birthdayWindow("10-05", new Date("2026-10-02T00:00:00Z"))).toBe(3);
    expect(birthdayWindow("11-20", new Date("2026-10-02T00:00:00Z"))).toBeNull();
  });

  it("handles year-end birthday wrap", () => {
    expect(birthdayWindow("01-02", new Date("2026-12-29T00:00:00Z"))).toBe(4);
  });
});
