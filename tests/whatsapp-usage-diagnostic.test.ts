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
  it("keeps authorization before the server-only reader", () => {
    const source = readFileSync("src/lib/whatsapp-usage.functions.ts", "utf8");
    expect(source.indexOf("await authorizeTenant")).toBeLessThan(
      source.indexOf("return readReplyUsage"),
    );
    expect(source).toContain("whatsapp-usage-read.server");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
});
