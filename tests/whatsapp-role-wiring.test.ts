import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Wiring proof for the WhatsApp account lifecycle role fix: runtime role
 * behavior is covered by tests/auth-flow.test.ts; this asserts each lifecycle
 * handler actually requests the manager role.
 */
const source = readFileSync(join(__dirname, "../src/lib/whatsapp.functions.ts"), "utf8");
const blocks = source.split(/(?=export const \w+ = createServerFn)/).slice(1);
const byName = (name: string) => blocks.find((b) => b.startsWith(`export const ${name} `)) ?? "";

const MANAGER_GATED = [
  "connectWhatsApp",
  "refreshWhatsAppQr",
  "requestPairingCode",
  "disconnectWhatsApp",
  "resetWhatsAppAccount",
];

describe("WhatsApp account lifecycle role wiring", () => {
  for (const name of MANAGER_GATED) {
    it(`${name} requires a manager or owner`, () => {
      const block = byName(name);
      expect(block.length).toBeGreaterThan(0);
      expect(block).toContain('guard(data.tenantId, "managers")');
    });
  }

  it("sendWhatsAppText stays operator-level but routes through the guarded drafter send", () => {
    const block = byName("sendWhatsAppText");
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("guard(data.tenantId)");
    expect(block).not.toContain('"managers"');
    expect(block).toContain("sendDrafterReply(");
  });

  it("getWhatsAppStatus stays readable by any tenant role", () => {
    const block = byName("getWhatsAppStatus");
    expect(block).toContain("guard(data.tenantId)");
    expect(block).not.toContain('"managers"');
  });
});
