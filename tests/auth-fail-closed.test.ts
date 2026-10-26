import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://x"), // no Authorization header
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

const KEYS = ["ALLOW_INSECURE_DEMO", "PUBLIC_APP_URL", "REQUIRE_AUTH", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function load() {
  return import("@/lib/tenant-auth.server");
}

describe("auth is fail-closed", () => {
  it("requires auth when no environment variable is set at all", async () => {
    const { authRequired, authorizeTenant, requireUser } = await load();
    expect(authRequired()).toBe(true);
    await expect(authorizeTenant("any-restaurant")).rejects.toMatchObject({ status: 401 });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("is NOT opened by the old flag being absent or false", async () => {
    const { authRequired } = await load();
    process.env["REQUIRE_AUTH"] = "false";
    expect(authRequired()).toBe(true);
  });

  it("allows demo mode only when explicitly enabled on a non-https, non-production deployment", async () => {
    const { authRequired } = await load();
    process.env["ALLOW_INSECURE_DEMO"] = "true";
    expect(authRequired()).toBe(false);
    process.env["PUBLIC_APP_URL"] = "http://localhost:8080";
    expect(authRequired()).toBe(false);
  });

  it("ignores the demo flag on an https deployment", async () => {
    const { authRequired, authorizeTenant } = await load();
    process.env["ALLOW_INSECURE_DEMO"] = "true";
    process.env["PUBLIC_APP_URL"] = "https://app.flavourly.example";
    expect(authRequired()).toBe(true);
    await expect(authorizeTenant("any-restaurant")).rejects.toMatchObject({ status: 401 });
  });

  it("ignores the demo flag in production builds", async () => {
    const { authRequired } = await load();
    process.env["ALLOW_INSECURE_DEMO"] = "true";
    process.env["NODE_ENV"] = "production";
    expect(authRequired()).toBe(true);
  });
});
