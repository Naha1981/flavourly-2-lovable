import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const client = readFileSync("src/lib/whatsapp.server.ts", "utf8");
const webhook = readFileSync("src/routes/api/public/webhooks/whatsapp.ts", "utf8");
const ai = readFileSync("src/lib/reply-drafts.server.ts", "utf8");
describe("WhatsApp inbox contract", () => {
  it("uses the same inbox and AI routes as RevUp", () => {
    expect(client).toContain("https://zernio.com/api/v1");
    expect(client).toContain("/inbox/conversations/");
    expect(client).toContain("Authorization: `Bearer ${key}`");
    expect(ai).toContain("https://api.groq.com/openai/v1/chat/completions");
    expect(ai).toContain("openai/gpt-oss-120b");
    expect(ai).not.toContain("lovable.dev");
  });
  it("checks raw-body signature before any ingest effects", () => {
    expect(webhook).toContain('request.headers.get("x-zernio-signature")');
    expect(webhook).toContain('request.headers.get("x-late-signature")');
    expect(webhook).toContain('createHmac("sha256", secret ??');
    expect(webhook.indexOf("timingSafeEqual(a, b)")).toBeLessThan(
      webhook.indexOf("const { ingestPayload"),
    );
  });
  it("defaults effects off and requires a recent incoming conversation", () => {
    expect(client).toContain('process.env["WHATSAPP_SEND_ENABLED"] !== "true"');
    expect(client).toContain('process.env["WHATSAPP_CONNECT_ENABLED"] !== "true"');
    expect(client).toContain("last_inbound_at");
    expect(client).toContain("86400000");
    expect(client).not.toContain('"/send"');
  });
});
