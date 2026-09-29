/** Deterministic 50/50 split so a phone always lands in the same variant if a campaign is re-run. */
export function assignVariant(phone: string, hasB: boolean): "a" | "b" {
  if (!hasB) return "a";
  let h = 2166136261;
  for (let i = 0; i < phone.length; i++) {
    h ^= phone.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100 < 50 ? "a" : "b";
}

export const ATTRIBUTION_WINDOW_DAYS = 7;

export const SEGMENT_LABEL: Record<string, string> = {
  all: "All guests",
  vip: "VIP guests",
  dormant_30: "Haven't visited in 30+ days",
  dormant_60: "Haven't visited in 60+ days",
};
