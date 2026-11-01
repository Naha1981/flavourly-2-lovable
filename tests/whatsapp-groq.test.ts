import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateReplyDraft } from "@/lib/reply-drafts.server";
const input = {
  message: "Menu please",
  intent: "faq" as const,
  restaurant: { name: "Venue A" },
  menuFacts: "Rice R40",
};
beforeEach(() => {
  process.env["GROQ_API_KEY"] = "test-only";
  process.env["WHATSAPP_AI_ENABLED"] = "true";
});
afterEach(() => {
  delete process.env["GROQ_API_KEY"];
  delete process.env["WHATSAPP_AI_ENABLED"];
  vi.unstubAllGlobals();
});
describe("free AI route", () => {
  it("stays off until the free account has been checked", async () => {
    delete process.env["WHATSAPP_AI_ENABLED"];
    vi.stubGlobal("fetch", vi.fn());
    expect((await generateReplyDraft(input)).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the RevUp primary and fallback, without a paid gateway", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: "INTENT: faq\n---\nRice costs R40." } }] }),
      );
    vi.stubGlobal("fetch", f);
    const result = await generateReplyDraft(input);
    expect(result.ok).toBe(true);
    expect(f.mock.calls.map((c) => JSON.parse(c[1].body).model)).toEqual([
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ]);
    for (const call of f.mock.calls)
      expect(call[0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});
