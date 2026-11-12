import { describe, expect, it } from "vitest";
import { dueTier, reservationStart } from "../src/lib/booking/reminders";

// Booking: Friday 2 Oct 2026 19:30 SAST = 17:30Z
const start = reservationStart("2026-10-02", "19:30");
const earlyBooked = new Date("2026-09-20T08:00:00Z");

describe("reminder ladder", () => {
  it("converts SAST booking time to UTC", () => {
    expect(start.toISOString()).toBe("2026-10-02T17:30:00.000Z");
  });
  it("sends nothing more than 48h out", () => {
    expect(dueTier(start, earlyBooked, new Date("2026-09-30T17:29:00Z"))).toBeNull();
  });
  it("sends the 48h, 24h and 6h tiers at their moments", () => {
    expect(dueTier(start, earlyBooked, new Date("2026-09-30T17:31:00Z"))).toBe(48);
    expect(dueTier(start, earlyBooked, new Date("2026-10-01T17:31:00Z"))).toBe(24);
    expect(dueTier(start, earlyBooked, new Date("2026-10-02T11:31:00Z"))).toBe(6);
  });
  it("only sends the closest tier after an outage, not a burst", () => {
    expect(dueTier(start, earlyBooked, new Date("2026-10-02T12:00:00Z"))).toBe(6);
  });
  it("skips tiers that passed before the booking was made", () => {
    const lateBooked = new Date("2026-10-02T09:00:00Z"); // 8.5h ahead
    expect(dueTier(start, lateBooked, new Date("2026-10-02T09:05:00Z"))).toBeNull();
    expect(dueTier(start, lateBooked, new Date("2026-10-02T11:31:00Z"))).toBe(6);
  });
  it("sends nothing once the booking has started", () => {
    expect(dueTier(start, earlyBooked, new Date("2026-10-02T17:31:00Z"))).toBeNull();
  });
});
