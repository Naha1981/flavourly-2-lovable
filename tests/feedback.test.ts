import { describe, expect, it } from "vitest";
import {
  newVoucherCode,
  nextFeedbackStep,
  normalizeVoucherCode,
  parseRating,
} from "../src/lib/feedback";

describe("parseRating", () => {
  it("accepts a bare 1-5 with light decoration", () => {
    for (const t of ["4", " 5 ", "3/5", "2 stars", "1 star", "5!", "4★"])
      expect(parseRating(t)).toBe(Number(t.trim()[0]));
  });
  it("rejects out-of-range and free text", () => {
    for (const t of ["0", "6", "10", "table for 4", "4 people tomorrow", "yes"])
      expect(parseRating(t)).toBeNull();
  });
});

describe("nextFeedbackStep", () => {
  it("asked: only a rating advances", () => {
    expect(nextFeedbackStep("asked", "2")).toEqual({ kind: "rating", rating: 2 });
    expect(nextFeedbackStep("asked", "the food was cold")).toBeNull();
    expect(nextFeedbackStep("asked", "   ")).toBeNull();
  });
  it("awaiting_comment: free text is the comment, a digit changes the rating", () => {
    expect(nextFeedbackStep("awaiting_comment", "Drinks took 40 minutes")).toEqual({
      kind: "comment",
      text: "Drinks took 40 minutes",
    });
    expect(nextFeedbackStep("awaiting_comment", "4")).toEqual({ kind: "rating", rating: 4 });
  });
  it("caps comment length", () => {
    const step = nextFeedbackStep("awaiting_comment", "x".repeat(5000));
    expect(step && step.kind === "comment" && step.text.length).toBe(1000);
  });
});

describe("newVoucherCode", () => {
  it("is 8 unambiguous characters", () => {
    expect(newVoucherCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
});

describe("normalizeVoucherCode", () => {
  it("ignores case, spaces and dashes", () => {
    expect(normalizeVoucherCode(" ab-c 2k9x ")).toBe("ABC2K9X");
  });
});
