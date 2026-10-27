import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Role matrix for sensitive server functions. tenant-guard.test.ts proves an
 * authorisation call EXISTS; this proves it is the RIGHT ROLE, so a manager-only
 * action can't quietly become available to staff.
 */
type Level = "manager" | "any";

function levelOf(source: string, name: string): Level {
  const start = source.indexOf(`export const ${name} =`);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("export const ", start + 10);
  const block = source.slice(start, next === -1 ? undefined : next);
  // Files whose guard helper always demands MANAGERS.
  if (/authorizeTenant\(tenantId, MANAGERS\)/.test(source)) return "manager";
  return /"manager"|"managers"|MANAGERS/.test(block) ? "manager" : "any";
}

const read = (file: string) => readFileSync(join(process.cwd(), "src", "lib", file), "utf8");

const MATRIX: Array<[file: string, fn: string, level: Level]> = [
  ["whatsapp.functions.ts", "connectWhatsApp", "manager"],
  ["whatsapp.functions.ts", "refreshWhatsAppQr", "manager"],
  ["whatsapp.functions.ts", "requestPairingCode", "manager"],
  ["whatsapp.functions.ts", "disconnectWhatsApp", "manager"],
  ["whatsapp.functions.ts", "resetWhatsAppAccount", "manager"],
  ["whatsapp.functions.ts", "getWhatsAppStatus", "any"],
  ["whatsapp.functions.ts", "sendWhatsAppText", "any"],
  ["intelligence/functions.ts", "runRevenueEmployeeFn", "manager"],
  ["intelligence/functions.ts", "setRevenueEmployeeModeFn", "manager"],
  ["intelligence/functions.ts", "approveRevenueActionFn", "manager"],
  ["intelligence/functions.ts", "getRevenueEmployeeSnapshot", "any"],
  ["billing.functions.ts", "startCheckout", "manager"],
  ["billing.functions.ts", "cancelPlan", "manager"],
  ["approval.functions.ts", "resolveApprovalRequest", "manager"],
  ["campaigns.functions.ts", "sendCampaign", "manager"],
];

describe("role matrix", () => {
  for (const [file, fn, level] of MATRIX) {
    it(`${fn} requires ${level}`, () => {
      expect(levelOf(read(file), fn)).toBe(level);
    });
  }

  it("never takes the approver's identity from the request body", () => {
    expect(read("intelligence/functions.ts")).not.toMatch(/approvedBy:\s*z\./);
    // Approvals may accept a demo-mode label, but the authenticated user must always win.
    expect(read("approval.functions.ts")).toMatch(/\(await actorId\(\)\) \?\? data\.resolvedBy/);
  });

  it("sendWhatsAppText never forwards a browser-supplied WhatsApp account id", () => {
    const source = read("whatsapp.functions.ts");
    const block = source.slice(source.indexOf("export const sendWhatsAppText"), source.indexOf("export const disconnectWhatsApp"));
    expect(block).toContain("sendManualReply");
    expect(block).not.toContain("data.waAccountId");
  });
});
