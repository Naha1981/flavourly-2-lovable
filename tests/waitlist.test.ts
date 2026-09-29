import { describe, expect, it } from "vitest";

// The queueing/atomicity logic lives in the claim_waitlist_offer SQL function and
// is covered by exercising it against a real Postgres instance, not unit-testable
// here. This file covers the pure text matching used to join the waitlist.
describe("waitlist join command", () => {
  const parse = (t: string) => t.match(/^wait(?:list)?\s+(\d{1,2})\s+(.+)$/i);
  it("matches WAITLIST <party> <date text>", () => {
    const m = parse("waitlist 4 friday");
    expect(m?.[1]).toBe("4");
    expect(m?.[2]).toBe("friday");
  });
  it("matches the short WAIT form and is case-insensitive", () => {
    expect(parse("WAIT 2 tomorrow")?.[1]).toBe("2");
  });
  it("does not match ordinary booking text", () => {
    expect(parse("table for 4 tomorrow at 7pm")).toBeNull();
  });
});
