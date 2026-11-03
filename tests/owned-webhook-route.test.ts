import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const s = vi.hoisted(() => ({ ingest: vi.fn(), verified: false }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (x: unknown) => x }));
vi.mock("@/lib/tenant-whatsapp.server", () => ({
  customerOwnedEnabled: () => true,
  verifyTenantWebhook: async () => s.verified,
}));
vi.mock("@/lib/webhook-ingest.server", () => ({ ingestPayload: s.ingest, tenantOf: () => null }));
vi.mock("@/lib/db.server", () => ({
  db: async () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
}));
import { Route } from "../src/routes/api/public/webhooks/whatsapp";
const post = (
  Route as unknown as {
    server: { handlers: { POST: (x: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
beforeEach(() => {
  s.verified = false;
  s.ingest.mockReset().mockResolvedValue({ events: 1, saved: 1, failures: [] });
  vi.stubEnv("WHATSAPP_CUSTOMER_OWNED_ENABLED", "true");
  vi.stubEnv("ZERNIO_WEBHOOK_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("owned webhook fail-closed boundary", () => {
  it("parses routing data but cannot ingest unauthenticated data", async () => {
    const r = await post({
      request: new Request("https://fixture.invalid/api/public/webhooks/whatsapp", {
        method: "POST",
        body: JSON.stringify({
          event: "message.received",
          account: { accountId: "foreign", profileId: "foreign" },
        }),
      }),
    });
    expect(r.status).toBe(401);
    expect(s.ingest).not.toHaveBeenCalled();
  });
  it("accepts verified tenant signature without global operator secret", async () => {
    s.verified = true;
    const r = await post({
      request: new Request("https://fixture.invalid/api/public/webhooks/whatsapp", {
        method: "POST",
        body: '{"event":"message.received"}',
      }),
    });
    expect(r.status).toBe(200);
    expect(s.ingest).toHaveBeenCalledOnce();
  });
});
