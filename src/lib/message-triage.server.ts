import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

export type TriageInput = {
  message: string;
  guestName?: string;
  restaurant: { name: string; hours?: string; notes?: string };
};

export type Triage = {
  intent: "booking" | "faq" | "complaint" | "catering" | "other";
  urgency: "low" | "medium" | "high";
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  nextAction: string;
  owner: "AI can reply" | "Manager" | "Kitchen" | "Front of house";
};

export type TriageResult = ({ ok: true } & Triage) | { ok: false; error: string; status?: number };

const pick = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  opts.includes(String(v).toLowerCase() as T) ? (String(v).toLowerCase() as T) : fallback;

function friendlyError(status?: number) {
  if (status === 402) return "AI credits have run out for this workspace. Top up in workspace billing to keep going.";
  if (status === 403) return "AI is currently blocked for this workspace. A workspace admin needs to check AI settings.";
  if (status === 429) return "Too many requests at once — please wait a few seconds and try again.";
  return "The message couldn't be analysed right now. Please try again shortly.";
}

export async function triageMessage(input: TriageInput): Promise<TriageResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "AI isn't configured yet." };

  const r = input.restaurant;
  const system = [
    `You triage guest messages for ${r.name}, a South African restaurant, so a busy manager knows what to do next.`,
    r.hours ? `Opening hours: ${r.hours}.` : "",
    r.notes ? `House notes: ${r.notes}` : "",
    "Urgency: high = guest is upset, event today/tonight, or safety/allergy issue; medium = needs a reply within hours; low = general question.",
    "nextAction: one concrete instruction for staff, under 20 words, imperative voice.",
    "summary: under 15 words.",
    'Respond with ONLY a JSON object: {"intent":"booking|faq|complaint|catering|other","urgency":"low|medium|high","sentiment":"positive|neutral|negative","summary":"...","nextAction":"...","owner":"AI can reply|Manager|Kitchen|Front of house"}',
  ]
    .filter(Boolean)
    .join("\n");

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let streamError: unknown;
  try {
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system,
      prompt: `${input.guestName ? `Guest: ${input.guestName}\n` : ""}Message:\n"""${input.message}"""`,
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = (await result.text).trim();
    if (!text) throw streamError ?? new Error("empty");
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return {
      ok: true,
      intent: pick(json.intent, ["booking", "faq", "complaint", "catering", "other"] as const, "other"),
      urgency: pick(json.urgency, ["low", "medium", "high"] as const, "medium"),
      sentiment: pick(json.sentiment, ["positive", "neutral", "negative"] as const, "neutral"),
      summary: String(json.summary ?? "").slice(0, 160),
      nextAction: String(json.nextAction ?? "Reply to the guest.").slice(0, 200),
      owner: (["AI can reply", "Manager", "Kitchen", "Front of house"] as const).find((o) => o === json.owner) ?? "Manager",
    };
  } catch (error) {
    const err = streamError ?? error;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("triage failed", status, err);
    return { ok: false, error: friendlyError(status), status };
  }
}
