import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { replyUsageErrorReference } from "../src/lib/whatsapp-usage-diagnostic.server";

describe("allowance diagnostics", () => {
  it.each(["PGRST202", "42501", "42703", "42P01", "P0001"])(
    "preserves safe database reference %s",
    (code) => {
      expect(
        replyUsageErrorReference({ code, message: "private data", details: "private SQL" }),
      ).toBe(code);
    },
  );
  it("does not disclose database prose or malformed codes", () => {
    for (const error of [
      { code: "secret tenant message" },
      { message: "private data" },
      new Error("private data"),
      { code: "PGRST202\nsecret" },
    ]) {
      expect(replyUsageErrorReference(error)).toBe("RPC_ERROR");
    }
    expect(replyUsageErrorReference(null)).toBe("EMPTY_RESULT");
  });
  it("keeps authorization before the existing RPC, no additional database action", () => {
    const source = readFileSync("src/lib/whatsapp-usage.functions.ts", "utf8");
    expect(source.indexOf("await authorizeTenant")).toBeLessThan(
      source.indexOf('.rpc("wa_reply_usage"'),
    );
    expect(source.match(/\.rpc\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.update\(|\.delete\(/);
    expect(source).toContain("console.error");
    expect(source).not.toContain("result.error.message");
  });
});
