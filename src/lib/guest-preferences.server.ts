import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

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

const list = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 60)) : [];

function friendlyError(status?: number) {
  if (status === 402) return "AI credits have run out for this workspace. Top up in workspace billing to keep going.";
  if (status === 403) return "AI is currently blocked for this workspace. A workspace admin needs to check AI settings.";
  if (status === 429) return "Too many requests at once — please wait a few seconds and try again.";
  return "We couldn't read this conversation right now. Please try again shortly.";
}

export async function extractPreferences(input: {
  conversation: string;
  guestName?: string | undefined;
  restaurantName: string;
}): Promise<PreferencesResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "AI isn't configured yet." };

  const system = [
    `You read WhatsApp conversations between guests and ${input.restaurantName}, a South African restaurant, and pull out dining preferences for the guest profile.`,
    "Only include facts the guest stated or clearly implied. Never invent. Empty arrays are fine.",
    "Treat allergies as safety-critical: list every allergy or intolerance mentioned.",
    "dietary: e.g. vegan, vegetarian, halaal, kosher, gluten-free. seating: e.g. patio, booth, quiet corner, wheelchair access. occasions: e.g. anniversary, birthday, business lunch. favourites: dishes they liked or ordered. drinks: drink preferences.",
    "spend: premium if they order wine/large parties/premium dishes, budget if price-sensitive, else mid or unknown.",
    "tags: 2-5 short profile tags (e.g. 'Regular', 'Celebrates here', 'Nut allergy').",
    "notes: 1-3 short sentences for staff on how to look after this guest next time.",
    'Respond with ONLY JSON: {"dietary":[],"allergies":[],"seating":[],"occasions":[],"favourites":[],"drinks":[],"spend":"unknown|budget|mid|premium","tags":[],"notes":"..."}',
  ].join("\n");

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
      prompt: `${input.guestName ? `Guest: ${input.guestName}\n` : ""}Conversation:\n"""${input.conversation}"""`,
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
    const spend = ["budget", "mid", "premium"].includes(json.spend) ? json.spend : "unknown";
    return {
      ok: true,
      dietary: list(json.dietary),
      allergies: list(json.allergies),
      seating: list(json.seating),
      occasions: list(json.occasions),
      favourites: list(json.favourites),
      drinks: list(json.drinks),
      spend,
      tags: list(json.tags).slice(0, 5),
      notes: String(json.notes ?? "").slice(0, 400),
    };
  } catch (error) {
    const err = streamError ?? error;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("preferences failed", status, err);
    return { ok: false, error: friendlyError(status) };
  }
}
