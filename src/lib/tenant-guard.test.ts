import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every server function that takes a tenantId must authorise the caller for that tenant. */
describe("tenant isolation guard", () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".functions.ts"));
  it("has server function files to check", () => expect(files.length).toBeGreaterThan(10));
  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    const blocks = src.split(/(?=export const \w+ = createServerFn)/).slice(1);
    for (const b of blocks) {
      const name = /export const (\w+)/.exec(b)?.[1] ?? "unknown";
      const [head, handler = ""] = b.split(".handler");
      if (!/tenantId/.test(head)) continue;
      it(`${f} ${name} authorises the tenant`, () => {
        expect(/(await \w*(guard|authorize|ownerOnly)\w*\(|authorizeTenant\()/.test(handler)).toBe(true);
      });
    }
  }
});
