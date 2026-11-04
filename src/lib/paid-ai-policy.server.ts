/** Paid AI is unavailable in this free-only release, even if a key or old flag remains set.
 * Re-enabling it requires a reviewed code change, explicit spending authority, and
 * atomic tenant/global usage checks at every provider boundary. No env switch here.
 */
export const PAID_AI_PAUSED_MESSAGE =
  "This AI feature is paused in free-only mode. Your team can review the message manually.";
