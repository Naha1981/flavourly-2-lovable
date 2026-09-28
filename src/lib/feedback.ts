/** Pure parsing for the post-visit feedback conversation. */
export type FeedbackState = "asked" | "awaiting_comment";

export type FeedbackStep = { kind: "rating"; rating: number } | { kind: "comment"; text: string };

export function parseRating(text: string): number | null {
  const m = text.trim().match(/^([1-5])(?:\s*(?:\/\s*5|stars?|★))?[\s.!]*$/i);
  return m ? Number(m[1]) : null;
}

export function nextFeedbackStep(state: FeedbackState, text: string): FeedbackStep | null {
  const t = text.trim();
  if (!t) return null;
  if (state === "asked") {
    const rating = parseRating(t);
    return rating === null ? null : { kind: "rating", rating };
  }
  // Awaiting a comment: a bare digit is a changed mind about the rating, not a comment.
  const rating = parseRating(t);
  return rating !== null ? { kind: "rating", rating } : { kind: "comment", text: t.slice(0, 1000) };
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newVoucherCode = (
  random: (n: number) => number = (n) => Math.floor(Math.random() * n),
) => Array.from({ length: 8 }, () => ALPHABET[random(ALPHABET.length)]).join("");

export const RECOVERY_DEFAULT_CENTS = 15_000;
export const RECOVERY_MAX_CENTS = 100_000;
