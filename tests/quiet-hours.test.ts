import { describe, expect, it } from "vitest";
import {
  isWithinSendWindow,
  nextSendWindowStart,
  sastDateString,
} from "../src/lib/whatsapp/quiet-hours";

// SAST = UTC+2, so 07:00 SAST = 05:00Z and 20:00 SAST = 18:00Z.
describe("send window (07:00–20:00 SAST)", () => {
  it("allows 07:00:00 and blocks 06:59:59", () => {
    expect(isWithinSendWindow(new Date("2026-09-28T05:00:00Z"))).toBe(true);
    expect(isWithinSendWindow(new Date("2026-09-28T04:59:59Z"))).toBe(false);
  });
  it("allows 19:59:59 and blocks 20:00:00", () => {
    expect(isWithinSendWindow(new Date("2026-09-28T17:59:59Z"))).toBe(true);
    expect(isWithinSendWindow(new Date("2026-09-28T18:00:00Z"))).toBe(false);
  });
  it("delays evening sends to 07:00 SAST next day", () => {
    expect(nextSendWindowStart(new Date("2026-09-28T19:30:00Z")).toISOString()).toBe(
      "2026-09-29T05:00:00.000Z",
    );
  });
  it("delays pre-dawn sends to 07:00 SAST same day", () => {
    expect(nextSendWindowStart(new Date("2026-09-28T02:00:00Z")).toISOString()).toBe(
      "2026-09-28T05:00:00.000Z",
    );
  });
  it("returns the same instant when already inside the window", () => {
    const d = new Date("2026-09-28T10:00:00Z");
    expect(nextSendWindowStart(d)).toBe(d);
  });
  it("uses the SAST calendar date, not UTC", () => {
    expect(sastDateString(new Date("2026-09-28T23:30:00Z"))).toBe("2026-09-29");
  });
});
