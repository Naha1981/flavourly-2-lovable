import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contract guard for the NahaLabs Central WhatsApp Operator integration.
 * Flavourly never runs its own WhatsApp transport: no Baileys, no sockets,
 * no QR generation. All transport goes through the shared operator service,
 * and operator secrets never leave server-only modules.
 */
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const CLIENT = readFileSync(join(SRC, "lib", "whatsapp.server.ts"), "utf8");
const WEBHOOK = readFileSync(join(SRC, "routes", "api", "public", "webhooks", "whatsapp.ts"), "utf8");

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return allSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("central WhatsApp Operator contract", () => {
  it("authenticates to the operator with the platform scope headers", () => {
    expect(CLIENT).toMatch(/X-API-Key/);
    expect(CLIENT).toMatch(/X-App-Id/);
    expect(CLIENT).toMatch(/X-Tenant-Id/);
    expect(CLIENT).toMatch(/APP_ID = "flavourly"/);
  });

  it("represents every documented account transport route", () => {
    for (const path of [
      "/accounts/bootstrap",
      "/accounts/tenant-token",
      "/accounts/mine",
      "/connect",
      "/status",
      "/qr",
      "/pairing-code",
      "/reset",
      "/disconnect",
      '"/send"',
    ]) {
      expect(CLIENT.includes(path), `operator client is missing route ${path}`).toBe(true);
    }
  });

  it("keeps tenant credentials server-side and per-tenant", () => {
    expect(CLIENT).toMatch(/wa_operator_tenant_token/);
    expect(CLIENT).toMatch(/X-NahaLabs-Tenant-Token/);
    expect(CLIENT).not.toMatch(/process\.env\["OPERATOR_API_KEY"\][\s\S]{0,80}tenantToken/);
  });

  it("verifies inbound webhooks with HMAC before parsing", () => {
    expect(WEBHOOK).toMatch(/createHmac\("sha256", secret\)/);
    expect(WEBHOOK).toMatch(/timingSafeEqual/);
    expect(WEBHOOK.indexOf("timingSafeEqual")).toBeLessThan(WEBHOOK.indexOf("JSON.parse"));
  });

  it("models operator cold starts as a waking state, not a fake success", () => {
    expect(CLIENT).toMatch(/waking: true/);
    for (const code of [502, 503, 504]) expect(CLIENT).toContain(`res.status === ${code}`);
  });

  it("contains no Baileys or local socket code anywhere in src/", () => {
    const offenders: string[] = [];
    for (const file of allSourceFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      if (text.includes("@whiskeysockets/baileys") || /\bmakeWASocket\s*\(/.test(text) || /new\s+WASocket/.test(text)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps operator secrets out of browser-reachable modules", () => {
    const offenders: string[] = [];
    for (const file of allSourceFiles(SRC)) {
      const serverOnly = /\.server\.ts$/.test(file) || file.includes(`${join("routes", "api")}`) || file.includes("webhook-ingest");
      if (serverOnly) continue;
      const text = readFileSync(file, "utf8");
      if (/OPERATOR_API_KEY|WEBHOOK_SECRET|X-NahaLabs-Tenant-Token/.test(text)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
