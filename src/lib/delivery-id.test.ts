import { describe, it, expect, vi } from "vitest";
const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./db.server", () => ({
  db: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tenant_id: "fixture" }, error: null }),
          }),
        }),
      }),
    }),
    rpc: h.rpc,
  }),
}));
import { ingestPayload } from "./webhook-ingest.server";
describe("Zernio receipt identifier", () => {
  for (const platformMessageId of ["wamid.same-as-send", undefined]) {
    it(`matches ${platformMessageId ? "raw platform ID" : "legacy internal ID"}`, async () => {
      h.rpc.mockReset().mockResolvedValue({ data: true, error: null });
      await ingestPayload({
        id: "receipt",
        event: "message.delivered",
        timestamp: new Date().toISOString(),
        account: { platform: "whatsapp", accountId: "a", profileId: "p" },
        message: { id: "internal-message", platformMessageId },
      });
      expect(h.rpc).toHaveBeenCalledWith(
        "wa_record_delivery",
        expect.objectContaining({
          p_message: platformMessageId ?? "internal-message",
          p_status: "delivered",
        }),
      );
    });
  }
});
