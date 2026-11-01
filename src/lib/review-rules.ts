export const REVIEW_DELAYS = {
  check_in: 15 * 60_000,
  review: 2 * 3_600_000,
  reminder: 48 * 3_600_000,
} as const;
export type ReviewStep = keyof typeof REVIEW_DELAYS;
export function safeReviewUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["g.page", "search.google.com", "maps.google.com", "www.google.com", "google.com"].includes(
        u.hostname,
      )
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function reviewMessage(step: ReviewStep, venue: string, link: string) {
  const body =
    step === "check_in"
      ? `Thanks for visiting ${venue}. How was your visit? Tell us if anything needs attention.`
      : step === "review"
        ? `Thanks for visiting ${venue}. Would you share your honest experience in a Google review? ${link}`
        : `A quick reminder from ${venue}: if you'd like to share your experience, here's your review link: ${link}`;
  return body + "\nReply STOP to opt out.";
}
