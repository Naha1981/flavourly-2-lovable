import { describe, expect, it } from "vitest";
import { parseBookingText } from "../src/lib/booking/parse";

const now = new Date("2026-09-28T10:00:00Z"); // Monday 28 Sep 2026, 12:00 SAST

describe("parseBookingText", () => {
  it("parses the flagship example without mistaking 7 for the party size", () => {
    const r = parseBookingText("Hey! I want to book a table for 4 guests tomorrow at 7pm", now);
    expect(r).toMatchObject({ partySize: 4, date: "2026-09-29", time: "19:00" });
  });
  it("parses 24h time and weekday", () => {
    const r = parseBookingText("table for 2 on friday at 19:30", now);
    expect(r).toMatchObject({ partySize: 2, date: "2026-10-02", time: "19:30" });
  });
  it("does not read a time as a party size", () => {
    expect(parseBookingText("tomorrow at 7pm", now).partySize).toBeUndefined();
    expect(parseBookingText("19:30", now).partySize).toBeUndefined();
  });
  it("reads bare 'at 8' as 20:00", () => {
    expect(parseBookingText("saturday at 8", now).time).toBe("20:00");
  });
  it("parses day-month dates and rolls past dates to next year", () => {
    expect(parseBookingText("2 Oct", now).date).toBe("2026-10-02");
    expect(parseBookingText("5 Jan", now).date).toBe("2027-01-05");
  });
  it("extracts names", () => {
    expect(parseBookingText("under the name sarah m", now).name).toBe("Sarah M");
  });
  it("detects confirm and cancel", () => {
    expect(parseBookingText("YES", now).isConfirm).toBe(true);
    expect(parseBookingText("Cancel", now).isCancel).toBe(true);
    expect(parseBookingText("yes please for 4", now).isConfirm).toBe(false);
  });
});
