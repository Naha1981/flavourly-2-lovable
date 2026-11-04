import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { triageMessage } from "@/lib/message-triage.server";
import { extractPreferences } from "@/lib/guest-preferences.server";
import { PAID_AI_PAUSED_MESSAGE } from "@/lib/paid-ai-policy.server";

const root = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("free-only paid AI boundary", () => {
  it.each([undefined, "stale-configured-key"])(
    "never calls a provider with key %s",
    async (key) => {
      vi.stubEnv("LOVABLE_API_KEY", key);
      vi.stubEnv("WHATSAPP_AI_ENABLED", "true");
      vi.stubEnv("FLAVOURLY_AI_ENABLED", "true");
      const fetch = vi.fn(() => {
        throw new Error("Network must not be used");
      });
      vi.stubGlobal("fetch", fetch);
      const responses = await Promise.all(
        Array.from({ length: 25 }, async () => [
          await triageMessage({ message: "Book for two", restaurant: { name: "Synthetic" } }),
          await extractPreferences({
            conversation: "I prefer a quiet table",
            restaurantName: "Synthetic",
          }),
        ]),
      );
      for (const pair of responses)
        for (const result of pair)
          expect(result).toEqual({ ok: false, error: PAID_AI_PAUSED_MESSAGE });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("contains no dormant paid-provider path or environment re-enable switch", () => {
    for (const file of ["message-triage.server.ts", "guest-preferences.server.ts"]) {
      const source = root("src/lib/" + file);
      expect(source).not.toMatch(/createOpenAI|streamText|generateText|process\.env|\bfetch\s*\(/);
      expect(source).not.toContain("ai.gateway.lovable.dev");
    }
  });

  it("binds triage to a required tenant and authorizes before entering its server boundary", () => {
    const source = root("src/lib/message-triage.functions.ts");
    expect(source).toContain("tenantId: z.string().trim().min(1).max(80)");
    expect(source).toContain("await authorizeTenant(data.tenantId)");
    expect(source.indexOf("await authorizeTenant(data.tenantId)")).toBeLessThan(
      source.indexOf("return triageMessage(data)"),
    );
    expect(root("src/components/app/message-triage.tsx")).toContain("tenantId: profile.slug");
  });

  it("preserves guest-preference tenant authorization and save workflow", () => {
    const source = root("src/lib/guest-preferences.functions.ts");
    expect(source.indexOf("await authorizeTenant(data.tenantId)")).toBeLessThan(
      source.indexOf("return extractPreferences(data)"),
    );
    expect(source).toContain("export const saveGuestPreferences");
  });
});
