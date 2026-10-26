import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runRetention, retentionConfig } from "@/lib/retention.server";
import { createFakeDb, type FakeDb } from "./helpers/fake-db";

const state = vi.hoisted(() => ({ db: null as unknown as FakeDb, calls: 0 }));
vi.mock("@/lib/db.server", () => ({
  db: async () => {
    state.calls += 1;
    return state.db;
  },
}));
vi.mock("../src/lib/db.server", () => ({
  db: async () => {
    state.calls += 1;
    return state.db;
  },
}));

const managedEnv = [
  "RETENTION_ENABLED",
  "RETENTION_DRY_RUN",
  "RETENTION_WA_MESSAGES_DAYS",
  "RETENTION_WA_WEBHOOK_EVENTS_DAYS",
  "RETENTION_OUTBOX_JOBS_DAYS",
  "RETENTION_BATCH",
] as const;
const previousEnv = new Map<string, string | undefined>();

const NOW = new Date("2026-10-26T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

beforeEach(() => {
  for (const key of managedEnv) {
    previousEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  state.db = createFakeDb();
  state.calls = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of managedEnv) {
    const value = previousEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnv.clear();
  vi.restoreAllMocks();
});

function seed() {
  const t = state.db.from("wa_messages");
  void t; // table created lazily on insert
  return state.db;
}

describe("retention sweeps", () => {
  it("is disabled by default and never touches the database", async () => {
    expect(retentionConfig().enabled).toBe(false);
    const report = await runRetention(NOW);
    expect(report.enabled).toBe(false);
    expect(report.tables).toEqual([]);
    expect(report.skipped).toHaveLength(3);
    expect(state.calls).toBe(0);
  });

  it("dry-runs by default even when enabled: counts but deletes nothing", async () => {
    process.env["RETENTION_ENABLED"] = "true";
    process.env["RETENTION_WA_MESSAGES_DAYS"] = "90";
    const db = seed();
    await db.from("wa_messages").insert([
      { tenant_id: "a", created_at: daysAgo(120), body: "old" },
      { tenant_id: "a", created_at: daysAgo(10), body: "new" },
    ]);
    const report = await runRetention(NOW);
    expect(report.dryRun).toBe(true);
    expect(report.tables).toEqual([
      { table: "wa_messages", windowDays: 90, matched: 1, deleted: 0, dryRun: true },
    ]);
    expect(await db.from("wa_messages").then((r) => r.data)).toHaveLength(2);
  });

  it("deletes only rows older than the window when fully enabled", async () => {
    process.env["RETENTION_ENABLED"] = "true";
    process.env["RETENTION_DRY_RUN"] = "false";
    process.env["RETENTION_WA_MESSAGES_DAYS"] = "90";
    process.env["RETENTION_WA_WEBHOOK_EVENTS_DAYS"] = "30";
    const db = seed();
    await db.from("wa_messages").insert([
      { tenant_id: "a", created_at: daysAgo(120), body: "old" },
      { tenant_id: "a", created_at: daysAgo(91), body: "old2" },
      { tenant_id: "a", created_at: daysAgo(10), body: "new" },
    ]);
    await db.from("wa_webhook_events").insert([
      { tenant_id: "a", created_at: daysAgo(45) },
      { tenant_id: "a", created_at: daysAgo(5) },
    ]);
    const report = await runRetention(NOW);
    expect(report.tables).toEqual([
      { table: "wa_messages", windowDays: 90, matched: 2, deleted: 2, dryRun: false },
      { table: "wa_webhook_events", windowDays: 30, matched: 1, deleted: 1, dryRun: false },
    ]);
    const remaining = (await db.from("wa_messages")).data as Array<Record<string, unknown>>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.["body"]).toBe("new");
  });

  it("only deletes terminal outbox jobs", async () => {
    process.env["RETENTION_ENABLED"] = "true";
    process.env["RETENTION_DRY_RUN"] = "false";
    process.env["RETENTION_OUTBOX_JOBS_DAYS"] = "60";
    const db = seed();
    await db.from("outbox_jobs").insert([
      { tenant_id: "a", created_at: daysAgo(100), status: "sent" },
      { tenant_id: "a", created_at: daysAgo(100), status: "failed" },
      { tenant_id: "a", created_at: daysAgo(100), status: "pending" },
    ]);
    const report = await runRetention(NOW);
    expect(report.tables[0]).toMatchObject({ table: "outbox_jobs", matched: 2, deleted: 2 });
    const remaining = (await db.from("outbox_jobs")).data as Array<Record<string, unknown>>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.["status"]).toBe("pending");
  });

  it("caps each sweep at the batch size", async () => {
    process.env["RETENTION_ENABLED"] = "true";
    process.env["RETENTION_DRY_RUN"] = "false";
    process.env["RETENTION_WA_MESSAGES_DAYS"] = "90";
    process.env["RETENTION_BATCH"] = "3";
    const db = seed();
    await db.from("wa_messages").insert(
      Array.from({ length: 5 }, (_, i) => ({ tenant_id: "a", created_at: daysAgo(100 + i), body: "m" + i })),
    );
    const report = await runRetention(NOW);
    expect(report.tables[0]).toMatchObject({ matched: 3, deleted: 3 });
    expect(await db.from("wa_messages").then((r) => r.data)).toHaveLength(2);
  });

  it("skips tables with no configured window", async () => {
    process.env["RETENTION_ENABLED"] = "true";
    process.env["RETENTION_DRY_RUN"] = "false";
    process.env["RETENTION_WA_MESSAGES_DAYS"] = "90";
    const report = await runRetention(NOW);
    expect(report.tables.map((t) => t.table)).toEqual(["wa_messages"]);
    expect(report.skipped).toEqual([
      { table: "wa_webhook_events", reason: "no window configured" },
      { table: "outbox_jobs", reason: "no window configured" },
    ]);
  });
});
