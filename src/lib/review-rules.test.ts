import { describe, it, expect } from "vitest";
import { REVIEW_DELAYS, reviewMessage, safeReviewUrl } from "./review-rules";
describe("post-visit review rules", () => {
  it("uses the RepEngine timing without rating gates", () => {
    expect(REVIEW_DELAYS).toEqual({ check_in: 900000, review: 7200000, reminder: 172800000 });
  });
  it("asks for honest feedback without incentives", () => {
    for (const s of ["check_in", "review", "reminder"] as const) {
      const body = reviewMessage(s, "Test venue", "https://test.invalid/review/token");
      expect(body).toContain("STOP");
      expect(body).not.toMatch(/5.star|positive|voucher|discount/i);
    }
    expect(reviewMessage("review", "Test", "LINK")).toContain("honest experience");
  });
  it.each([
    "javascript:alert(1)",
    "http://g.page/test",
    "https://g.page.evil.invalid/x",
    "https://user:pw@g.page/x",
    "https://evil.invalid/x",
    "oops",
  ])("rejects unsafe or non-review URL %s", (value) => expect(safeReviewUrl(value)).toBeNull());
  it.each([
    "https://g.page/r/example/review",
    "https://search.google.com/local/writereview?placeid=example",
  ])("accepts configured Google review destination %s", (value) =>
    expect(safeReviewUrl(value)).toBe(value),
  );
});
