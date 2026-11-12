import { describe, it, expect, vi } from "vitest";
import { signInWithCooldown } from "./login-cooldown";
describe("password login cooldown", () => {
  const opts = () => ({
    signal: new AbortController().signal,
    onWait: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    random: () => 0,
  });
  it("returns success immediately", async () => {
    const call = vi.fn().mockResolvedValue({ error: null });
    const o = opts();
    await signInWithCooldown(call, o);
    expect(call).toHaveBeenCalledTimes(1);
    expect(o.sleep).not.toHaveBeenCalled();
  });
  it("never retries wrong password or network/server errors", async () => {
    for (const status of [400, 401, 403, 500, 503]) {
      const call = vi.fn().mockResolvedValue({ error: { status } });
      await signInWithCooldown(call, opts());
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
  it("waits65seconds then retries once", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ error: { status: 429 } })
      .mockResolvedValueOnce({ error: null });
    const o = opts();
    expect((await signInWithCooldown(call, o)).error).toBeNull();
    expect(o.sleep).toHaveBeenCalledWith(65000, o.signal);
    expect(o.onWait).toHaveBeenCalledWith(65);
  });
  it("stops after a second throttle", async () => {
    const call = vi.fn().mockResolvedValue({ error: { status: 429 } });
    await signInWithCooldown(call, opts());
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("aborts without a retry", async () => {
    const controller = new AbortController();
    const call = vi.fn().mockResolvedValue({ error: { status: 429 } });
    const o = opts();
    await expect(
      signInWithCooldown(call, {
        ...o,
        signal: controller.signal,
        sleep: async () => {
          controller.abort();
        },
      }),
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("handles50 clients without bypassing the first throttle", async () => {
    let success = 0;
    await Promise.all(
      Array.from({ length: 50 }, async () => {
        const call = vi
          .fn()
          .mockResolvedValueOnce({ error: { status: 429 } })
          .mockResolvedValueOnce({ error: null });
        const o = opts();
        await signInWithCooldown(call, o);
        expect(o.sleep).toHaveBeenCalledWith(65000, o.signal);
        success++;
      }),
    );
    expect(success).toBe(50);
  });

  it("recognizes the provider code without a numeric status", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "over_request_rate_limit" } })
      .mockResolvedValueOnce({ error: null });
    await signInWithCooldown(call, opts());
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("caps the bounded jitter at79seconds", async () => {
    const call = vi.fn().mockResolvedValue({ error: { status: 429 } });
    const o = opts();
    await signInWithCooldown(call, { ...o, random: () => 0.999999 });
    expect(o.sleep).toHaveBeenCalledWith(79000, o.signal);
  });
  it("makes no call when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const call = vi.fn();
    await expect(
      signInWithCooldown(call, { ...opts(), signal: controller.signal }),
    ).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it("does not retry a rejected network request", async () => {
    const call = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(signInWithCooldown(call, opts())).rejects.toThrow("offline");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
