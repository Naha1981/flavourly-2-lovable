import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  FLAVOURLY_LIVE_TOOLS,
  type FlavourlyLiveToolName,
} from "./gemini-live.tools";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

const LIVE_SYSTEM_INSTRUCTION =
  "You are Flavourly Voice Operator, a real-time restaurant revenue and operations assistant. " +
  "Use Flavourly tools for factual restaurant information; never invent restaurant data, revenue figures, bookings, customers, menu items, prices or message counts. " +
  "The current Flavourly schema does not contain verified payment transactions, so never state a revenue number unless a tool explicitly returns one. " +
  "You can read restaurant data and create a social promotion draft. Creating a draft does not publish it and does not send WhatsApp messages. " +
  "Keep spoken responses concise, practical and natural for a busy South African restaurant manager. " +
  "When a tool returns data, distinguish facts from recommendations.";

const jsonResponse = async (response: Response) => {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }
  return { body, text };
};

const guard = async (tenantId: string) => {
  const { authorizeTenant } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId);
};

export const createGeminiLiveToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ tenantId: tenant }).parse(data))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      return {
        ok: false as const,
        error: "GEMINI_API_KEY is not configured on the Flavourly server.",
      };
    }

    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uses: 1,
          expireTime,
          newSessionExpireTime,
          liveConnectConstraints: {
            model: "gemini-3.8-live",
            config: {
              responseModalities: ["AUDIO"],
              sessionResumption: {},
              contextWindowCompression: {},
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: {
                parts: [{ text: LIVE_SYSTEM_INSTRUCTION }],
              },
              tools: [{ functionDeclarations: FLAVOURLY_LIVE_TOOLS }],
            },
          },
        }),
      },
    );

    const { body } = await jsonResponse(response);
    const tokenName = body["name"];
    if (!response.ok || typeof tokenName !== "string") {
      console.error("Gemini Live token provisioning failed", response.status, body);
      return {
        ok: false as const,
        error: "Gemini could not start a Live session right now.",
      };
    }

    return {
      ok: true as const,
      token: tokenName,
      expiresAt: expireTime,
      newSessionExpiresAt: newSessionExpireTime,
    };
  });

export const runGeminiLiveTool = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown) =>
      z
        .object({
          tenantId: tenant,
          name: z.string(),
          args: z.record(z.unknown()).refine((o) => Object.keys(o).length <= 50, "Too many arguments.").default({}),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    const { executeFlavourlyLiveTool } = await import("./gemini-live.server");
    const validNames = new Set<string>(FLAVOURLY_LIVE_TOOLS.map((tool) => tool.name));
    if (!validNames.has(data.name)) {
      return { ok: false as const, error: "Tool not allowed." };
    }

    try {
      const result = await executeFlavourlyLiveTool(
        data.tenantId,
        data.name as FlavourlyLiveToolName,
        data.args,
      );
      return { ok: true as const, result };
    } catch (error) {
      console.error("Flavourly Live tool failed", data.name, error);
      return { ok: false as const, error: "The requested restaurant data could not be loaded." };
    }
  });
