import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, mapped: true }));
vi.mock("./db.server", () => ({
  APP_URL: () => "https://fixture.invalid",
  db: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: h.mapped ? { tenant_id: "tenant-a" } : null,
              error: null,
            }),
          }),
          maybeSingle: async () => ({
            data: table === "wa_tenant_credentials" ? h.row : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
import {
  encryptCredential,
  decryptCredential,
  ownedProviderKey,
  verifyTenantWebhook,
  inspectCustomerKey,
} from "./tenant-whatsapp.server";
import { createHmac } from "node:crypto";
beforeEach(() => {
  vi.stubEnv("WHATSAPP_CREDENTIALS_ENCRYPTION_KEY", "ab".repeat(32));
  vi.stubEnv("WHATSAPP_CUSTOMER_OWNED_ENABLED", "true");
  h.row = null;
  h.mapped = true;
});
afterEach(() => vi.unstubAllEnvs());
describe("customer-owned credential boundary", () => {
  it("encrypts non-deterministically, decrypts only for same tenant, rejects tampering", () => {
    const a = encryptCredential("fixture-key-never-live", "tenant-a"),
      b = encryptCredential("fixture-key-never-live", "tenant-a");
    expect(a).not.toContain("fixture-key");
    expect(a).not.toBe(b);
    expect(decryptCredential(a, "tenant-a")).toBe("fixture-key-never-live");
    expect(() => decryptCredential(a, "tenant-b")).toThrow();
    expect(() => decryptCredential(a.slice(0, -5) + "AAAAA", "tenant-a")).toThrow();
  });
  it("fails closed if encryption is unavailable", () => {
    vi.stubEnv("WHATSAPP_CREDENTIALS_ENCRYPTION_KEY", "");
    expect(() => encryptCredential("fixture", "tenant-a")).toThrow();
  });
  it("does not use a revoked tenant credential", async () => {
    h.row = { state: "needs_attention" };
    await expect(ownedProviderKey("tenant-a")).rejects.toThrow("needs attention");
  });
  it("binds HMAC to mapped tenant and rejects shared or other-tenant signature", async () => {
    h.row = { webhook_secret_ciphertext: encryptCredential("tenant-only-secret", "tenant-a") };
    const raw = JSON.stringify({ event: "message.received" }),
      p = { account: { accountId: "a", profileId: "p" } };
    const sig = (key: string) => createHmac("sha256", key).update(raw).digest("hex");
    expect(await verifyTenantWebhook(p, raw, sig("tenant-only-secret"))).toBe(true);
    expect(await verifyTenantWebhook(p, raw, sig("shared-secret"))).toBe(false);
    h.mapped = false;
    expect(await verifyTenantWebhook(p, raw, sig("tenant-only-secret"))).toBe(false);
  });
  it("does not validate a key while feature is off", async () => {
    vi.stubEnv("WHATSAPP_CUSTOMER_OWNED_ENABLED", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(inspectCustomerKey("fixture")).rejects.toThrow("not enabled");
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
