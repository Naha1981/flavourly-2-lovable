import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  alertConfigStatus,
  resetAlertThrottleForTests,
  sendAlert,
  signAlertBody,
  withCronAlert,
} from "@/lib/alerts.server";

const sendTextMock = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/whatsapp.server", () => ({ sendText: sendTextMock.fn }));
vi.mock("../src/lib/whatsapp.server", () => ({ sendText: sendTextMock.fn }));

const managedEnv = [
  "ALERT_WEBHOOK_URL",
  "ALERT_WEBHOOK_SECRET",
  "ALERT_OWNER_PHONE",
  "ALERT_WHATSAPP_TENANT_ID",
  "ALERT_WHATSAPP_ACCOUNT_ID",
  "ALERT_THROTTLE_SECONDS",
] as const;
const previousEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  for (const key of managedEnv) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  resetAlertThrottleForTests();
  mockFetch.mockReset().mockImplementation(async () => new Response("ok", { status: 200 }));
  globalThis.fetch = mockFetch;
  sendTextMock.fn.mockReset().mockResolvedValue({ ok: true as const, data: { messageId: "m-1" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of managedEnv) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnv.clear();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("alert transports", () => {
  it("always logs and reports unconfigured when no transport is set", async () => {
    const result = await sendAlert("k1", "critical", "Cron outbox failed", "boom");
    expect(result.delivered).toBe("unconfigured");
    expect(console.error).toHaveBeenCalledWith(
      "[flavourly-alert]",
      expect.stringContaining('"title":"Cron outbox failed"'),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts a HMAC-signed JSON payload to the configured webhook", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    process.env["ALERT_WEBHOOK_SECRET"] = "s3cret";
    const result = await sendAlert("k2", "warning", "Quota reached");
    expect(result.delivered).toBe("sent");
    const [url, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example/alert");
    const body = String(init.body);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-flavourly-signature"]).toBe(
      createHmac("sha256", "s3cret").update(body).digest("hex"),
    );
    expect(signAlertBody("s3cret", body)).toBe(headers["x-flavourly-signature"]);
    expect(JSON.parse(body)).toMatchObject({ key: "k2", level: "warning", product: "flavourly" });
  });

  it("refuses a plain-http webhook URL but still logs", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "http://hooks.example/alert";
    const result = await sendAlert("k3", "critical", "x");
    expect(result.delivered).toBe("unconfigured");
    expect(result.outcomes[0]).toMatch(/https/);
    expect(console.error).toHaveBeenCalled();
  });

  it("never throws when a transport fails", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const result = await sendAlert("k4", "critical", "x");
    expect(result.delivered).toBe("unconfigured");
    expect(result.outcomes[0]).toMatch(/network down/);
  });

  it("throttles repeated alerts with the same key", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    await sendAlert("k5", "critical", "first");
    const second = await sendAlert("k5", "critical", "second");
    expect(second.delivered).toBe("throttled");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sends a WhatsApp alert through the operator path when configured", async () => {
    process.env["ALERT_OWNER_PHONE"] = "+27610000000";
    process.env["ALERT_WHATSAPP_TENANT_ID"] = "t-1";
    process.env["ALERT_WHATSAPP_ACCOUNT_ID"] = "wa-1";
    const result = await sendAlert("k6", "critical", "Cron failed", "details here");
    expect(result.delivered).toBe("sent");
    expect(sendTextMock.fn).toHaveBeenCalledWith(
      "t-1",
      "wa-1",
      "+27610000000",
      expect.stringContaining("Cron failed"),
    );
  });

  it("reports config status without exposing secrets", () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    process.env["ALERT_WEBHOOK_SECRET"] = "s3cret";
    const status = alertConfigStatus();
    expect(status).toEqual({ webhook: true, whatsapp: false, throttleSeconds: 300 });
    expect(JSON.stringify(status)).not.toContain("s3cret");
  });
});

describe("withCronAlert", () => {
  it("passes through the result and stays quiet on success", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    const result = await withCronAlert("outbox", async () => 42);
    expect(result).toBe(42);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("alerts and rethrows on failure", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/alert";
    await expect(
      withCronAlert("outbox", async () => {
        throw new Error("db gone");
      }),
    ).rejects.toThrow("db gone");
    const [, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain("db gone");
  });
});
