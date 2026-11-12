import { describe, it, expect, vi, afterEach } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/db.server", () => ({ db: async () => state }));
import { readActivationReadiness } from "../src/lib/activation-readiness.server";
afterEach(() => {
  for (const k of [
    "WHATSAPP_CONNECT_ENABLED",
    "WHATSAPP_SEND_ENABLED",
    "WHATSAPP_AI_ENABLED",
    "ZERNIO_API_KEY",
    "GROQ_API_KEY",
  ])
    delete process.env[k];
});
describe("activation status reads", () => {
  it("reports missing RPC and switches without exposing secrets or enabling effects", async () => {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "private SQL" },
    });
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    state.from.mockReturnValue(chain);
    process.env["ZERNIO_API_KEY"] = "secret-never-return";
    const data = await readActivationReadiness("qa-a");
    expect(data).toMatchObject({
      connectEnabled: false,
      sendEnabled: false,
      aiEnabled: false,
      providerConfigured: true,
      allowanceRpcReady: false,
      allowanceReference: "PGRST202",
      accountBound: false,
    });
    expect(JSON.stringify(data)).not.toMatch(/secret-never-return|private SQL/);
    expect(chain.eq).toHaveBeenCalledWith("tenant_id", "qa-a");
  });
});
