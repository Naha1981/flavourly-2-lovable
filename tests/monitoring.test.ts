import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sendAlert", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env["ALERT_WEBHOOK_URL"];
    delete process.env["ALERT_WEBHOOK_FORMAT"];
  });

  it("does nothing (but logs) when no webhook is configured", async () => {
    const { sendAlert, alertsConfigured } = await import("@/lib/alert.server");
    const fetchImpl = vi.fn();
    expect(alertsConfigured()).toBe(false);
    expect(await sendAlert({ key: "a", severity: "critical", title: "t", fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts JSON compatible with Slack and Discord, and throttles repeats of the same key", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/abc";
    const { sendAlert } = await import("@/lib/alert.server");
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
    expect(await sendAlert({ key: "k", severity: "critical", title: "Outbox down", detail: "3 overdue", fetchImpl })).toBe(true);
    const body = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1].body);
    expect(body.text).toContain("[Flavourly critical] Outbox down");
    expect(body.content).toBe(body.text);
    expect(await sendAlert({ key: "k", severity: "critical", title: "Outbox down", fetchImpl })).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends plain text with a Title header for ntfy-style endpoints", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://ntfy.sh/my-topic";
    process.env["ALERT_WEBHOOK_FORMAT"] = "text";
    const { sendAlert } = await import("@/lib/alert.server");
    const fetchImpl = vi.fn(async () => new Response("ok")) as unknown as typeof fetch;
    await sendAlert({ key: "n", severity: "warning", title: "Slow", detail: "details", fetchImpl });
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(init.body).toBe("details");
    expect(init.headers.Title).toContain("Slow");
  });

  it("never throws when delivery fails", async () => {
    process.env["ALERT_WEBHOOK_URL"] = "https://hooks.example/abc";
    const { sendAlert } = await import("@/lib/alert.server");
    const fetchImpl = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    await expect(sendAlert({ key: "x", severity: "warning", title: "t", fetchImpl })).resolves.toBe(false);
  });
});

describe("runCronJob", () => {
  it("records a heartbeat and returns ok on success, and alerts + 500s on failure", async () => {
    vi.resetModules();
    const upserts: Array<Record<string, unknown>> = [];
    vi.doMock("@/lib/db.server", () => ({ db: async () => ({ from: () => ({ upsert: async (row: Record<string, unknown>) => { upserts.push(row); return { error: null }; } }) }) }));
    const alert = vi.fn(async () => true);
    vi.doMock("@/lib/alert.server", () => ({ sendAlert: alert }));
    const { runCronJob } = await import("@/lib/heartbeat.server");

    const ok = await runCronJob("outbox", async () => ({ sent: 2 }));
    expect(ok.status).toBe(200);
    expect(upserts[0]).toMatchObject({ name: "outbox", last_ok: true });

    const bad = await runCronJob("outbox", async () => { throw new Error("db down"); });
    expect(bad.status).toBe(500);
    expect(upserts[1]).toMatchObject({ name: "outbox", last_ok: false, last_detail: "db down" });
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({ severity: "critical" }));
    vi.doUnmock("@/lib/db.server");
    vi.doUnmock("@/lib/alert.server");
  });
});
