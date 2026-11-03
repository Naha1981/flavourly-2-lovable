import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const source = readFileSync("src/lib/whatsapp.functions.ts", "utf8");
describe("credential management server contracts", () => {
  for (const name of ["inspectMessagingKey", "saveMessagingKey"])
    it(name + " requires manager guard before secret processing", () => {
      const body = source.split("export const " + name + " =")[1]!.split("export const ")[0]!;
      expect(body).toContain('await guard(data.tenantId, "managers")');
      expect(body.indexOf("await guard")).toBeLessThan(body.indexOf("await import"));
    });
});
