import { describe, expect, it } from "vitest";

import { assertSafeProviderUrl } from "@/lib/intelligence/providers.server";

describe("assertSafeProviderUrl (KNOWN_LIMITS #13)", () => {
  it("accepts ordinary https and http operator endpoints", () => {
    expect(() => assertSafeProviderUrl("https://providers.example.com/api")).not.toThrow();
    expect(() => assertSafeProviderUrl("http://internal-mesh:8080")).not.toThrow();
  });

  it("rejects non-http protocols", () => {
    expect(() => assertSafeProviderUrl("file:///etc/passwd")).toThrow(/http or https/);
    expect(() => assertSafeProviderUrl("gopher://evil.example")).toThrow(/http or https/);
    expect(() => assertSafeProviderUrl("ftp://evil.example")).toThrow(/http or https/);
  });

  it("rejects credentials embedded in the URL", () => {
    expect(() => assertSafeProviderUrl("https://user:secret@providers.example.com")).toThrow(
      /credentials/,
    );
  });

  it("rejects unparseable values", () => {
    expect(() => assertSafeProviderUrl("not a url")).toThrow(/not a valid URL/);
    expect(() => assertSafeProviderUrl("")).toThrow(/not a valid URL/);
  });
});

describe("metadata and link-local blocking", () => {
  it("rejects cloud metadata endpoints", () => {
    expect(() => assertSafeProviderUrl("http://169.254.169.254/latest/meta-data")).toThrow(/link-local|metadata/);
    expect(() => assertSafeProviderUrl("https://metadata.google.internal/")).toThrow(/link-local|metadata/);
  });
});
