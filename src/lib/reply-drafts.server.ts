import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

export type ReplyIntent = "auto" | "booking" | "faq" | "complaint";

export type DraftInput = {
  message: string;
  intent: ReplyIntent;
  guestName?: string | undefined;
  /** Menu lines from the database, so the reply never invents dishes or prices. */
  menuFacts?: string | undefined;
  /** House policies (deposits, corkage, kids, cancellations…) written by staff. */
  policies?: string | undefined;
  restaurant: {
    name: string;
    city?: string | undefined;
    cuisine?: string | undefined;
    hours?: string | undefined;
    averageCheck?: number | undefined;
    ownerName?: string | undefined;
    notes?: string | undefined;
  };
};

export type DraftResult =
  | { ok: true; intent: Exclude<ReplyIntent, "auto">; reply: string }
  | { ok: false; error: string; status?: number | undefined };

export type MenuFactRow = {
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  dietary_flags: string[] | null;
};

/** One line per dish: name, price in rand, dietary tags, sold-out flag. */
export function buildMenuFacts(items: MenuFactRow[]): string {
  return items
    .map((i) => {
      const tags = (i.dietary_flags ?? []).map((f) => f.replace("_", " ")).join(", ");
      return [
        `- ${i.name} — R${(i.price_cents / 100).toFixed(2).replace(/\.00$/, "")}`,
        tags ? ` (${tags})` : "",
        i.is_available ? "" : " [SOLD OUT today]",
        i.description ? `: ${i.description.slice(0, 120)}` : "",
      ].join("");
    })
    .join("\n");
}

const MODEL = "openai/gpt-6-astra";

function friendlyError(status?: number): string {
  switch (status) {
    case 402:
      return "AI credits have run out for this workspace. Top up in workspace billing to keep drafting.";
    case 403:
      return "AI drafting is currently blocked for this workspace. A workspace admin needs to check AI settings.";
    case 429:
      return "Lots of drafts at once — please wait a few seconds and try again.";
    default:
      return "The draft couldn't be written right now. Please try again shortly.";
  }
}

export async function generateReplyDraft(input: DraftInput): Promise<DraftResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, error: "AI drafting isn't configured yet." };

  const r = input.restaurant;
  const system = [
    `You write WhatsApp replies on behalf of ${r.name}${r.city ? `, a restaurant in ${r.city}` : ""}${r.cuisine ? ` serving ${r.cuisine}` : ""}.`,
    r.hours ? `Opening hours: ${r.hours}.` : "",
    r.averageCheck ? `Average spend per guest: R${r.averageCheck}.` : "",
    r.notes ? `House notes: ${r.notes}` : "",
    input.policies ? `House policies (follow exactly):\n${input.policies}` : "",
    input.menuFacts
      ? `Current menu (the only dishes and prices you may mention; never offer SOLD OUT items):\n${input.menuFacts}`
      : "No menu is loaded: do not name specific dishes or prices; say the team will share the menu.",
    "Voice: warm, confident, South African English, like a great front-of-house manager. Short sentences, no corporate filler, at most one emoji, no hashtags.",
    "Bookings: confirm details (date, time, party size, name) and offer a specific time when unclear. Never invent confirmed availability — phrase it as a hold pending confirmation.",
    "FAQs: answer directly using the facts above; if a fact is unknown, say the team will confirm shortly.",
    "Complaints: apologise specifically, take ownership, never blame the guest, offer to make it right personally and move the conversation to a call or a return visit.",
    `Keep the reply under 80 words.${r.ownerName ? ` Sign complaint replies as ${r.ownerName}.` : ""}`,
    "Output format, exactly:\nINTENT: booking|faq|complaint\n---\n<reply text>",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    input.intent !== "auto" ? `The manager has classified this as: ${input.intent}.` : "Classify the message yourself.",
    input.guestName ? `Guest name: ${input.guestName}` : "",
    `Guest message:\n"""${input.message}"""`,
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
      model: provider.responses(MODEL),
      system,
      prompt,
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

    const match = text.match(/INTENT:\s*(booking|faq|complaint)/i);
    const parsed = (match?.[1]?.toLowerCase() ?? (input.intent === "auto" ? "faq" : input.intent)) as
      | "booking"
      | "faq"
      | "complaint";
    const reply = text.includes("---") ? text.split("---").slice(1).join("---").trim() : text.replace(/INTENT:.*\n?/i, "").trim();
    return { ok: true, intent: parsed, reply };
  } catch (error) {
    const err = streamError ?? error;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("reply draft failed", status, err);
    return { ok: false, error: friendlyError(status), status };
  }
}
