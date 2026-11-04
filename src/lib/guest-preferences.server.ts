import { PAID_AI_PAUSED_MESSAGE } from "./paid-ai-policy.server";

export type GuestPreferences = {
  dietary: string[];
  allergies: string[];
  seating: string[];
  occasions: string[];
  favourites: string[];
  drinks: string[];
  spend: "unknown" | "budget" | "mid" | "premium";
  tags: string[];
  notes: string;
};

export type PreferencesResult = ({ ok: true } & GuestPreferences) | { ok: false; error: string };

/** Free-only release: no provider SDK, key lookup, network request or re-enable flag. */
export async function extractPreferences(_input: {
  conversation: string;
  guestName?: string | undefined;
  restaurantName: string;
}): Promise<PreferencesResult> {
  return { ok: false, error: PAID_AI_PAUSED_MESSAGE };
}
