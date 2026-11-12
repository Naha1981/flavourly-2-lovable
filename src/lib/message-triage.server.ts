import { PAID_AI_PAUSED_MESSAGE } from "./paid-ai-policy.server";

export type TriageInput = {
  message: string;
  guestName?: string | undefined;
  restaurant: { name: string; hours?: string | undefined; notes?: string | undefined };
};

export type Triage = {
  intent: "booking" | "faq" | "complaint" | "catering" | "other";
  urgency: "low" | "medium" | "high";
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  nextAction: string;
  owner: "AI can reply" | "Manager" | "Kitchen" | "Front of house";
};

export type TriageResult =
  ({ ok: true } & Triage) | { ok: false; error: string; status?: number | undefined };

/** Free-only release: no provider SDK, key lookup, network request or re-enable flag. */
export async function triageMessage(_input: TriageInput): Promise<TriageResult> {
  return { ok: false, error: PAID_AI_PAUSED_MESSAGE };
}
