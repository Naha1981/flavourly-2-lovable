import { describe, expect, it } from "vitest";

import {
  buildHealthReport,
  CRON_EXPECTATIONS,
  healthHttpStatus,
  recordCronHeartbeat,
} from "@/lib/health.server";

type Row = Record<string, unknown>;

/** Minimal cron_state-only supabase-style client for the health module. */
function mockClient(rows: Row[] = [], fail = false) {
  const store = rows;
  function from(_table: string) {
    let op: "select" | "insert" | "delete" = "select";
    let payload: Row | null = null;
    const eqFilters: [string, unknown][] = [];
    let likeFilter: [string, string] | null = null;
    const run = () => {
      if (fail) return { data: null, error: { message: "connection refused" } };
      if (op === "insert" && payload) {
        store.push({ ...payload });
        return { data: null, error: null };
      }
      if (op === "delete") {
        for (const [col, val] of eqFilters) {
          for (let i = store.length - 1; i >= 0; i--) if (store[i]![col] === val) store.splice(i, 1);
        }
        return { data: null, error: null };
      }
      let out = [...store];
      for (const [col, val] of eqFilters) out = out.filter((r) => r[col] === val);
      if (likeFilter) {
        const [col, pattern] = likeFilter;
        const prefix = pattern.replace(/%$/, "");
        out = out.filter((r) => String(r[col]).startsWith(prefix));
      }
      return { data: out, error: null };
    };
    const chain: Record<string, (...a: never[]) => unknown> = {
      select: () => chain,
      limit: () => Promise.resolve(run()),
      eq: (col: string, val: unknown) => {
        eqFilters.push([col, val]);
        return Object.assign(chain, { then: (res: (v: unknown) => void) => res(run()) });
      },
      like: (col: string, pattern: string) => {
        likeFilter = [col, pattern];
        return Object.assign(chain, { then: (res: (v: unknown) => void) => res(run()) });
      },
      insert: (p: Row) => {
        op = "insert";
        payload = p;
        return Promise.resolve(run());
      },
      delete: () => {
        op = "delete";
        return chain;
      },
    };
    return chain;
  }
  return { from: from as never, store };
}

const NOW = new Date("2026-10-27T10:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60000).toISOString();
const heartbeatRows = Object.keys(CRON_EXPECTATIONS).map((job) => ({
  job: "heartbeat:" + job,
  last_tenant: null,
  updated_at: minutesAgo(1),
}));

const okFetch = (() => Promise.resolve(new Response("ok"))) as typeof fetch;
const deadFetch = (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch;

describe("buildHealthReport", () => {
  it("is ok when db, operator and all cron heartbeats are fresh", async () => {
    process.env["OPERATOR_URL"] = "https://operator.example";
    const c = mockClient([...heartbeatRows]);
    const report = await buildHealthReport(c as never, NOW, okFetch);
    expect(report.status).toBe("ok");
    expect(report.db.ok).toBe(true);
    expect(report.operator.ok).toBe(true);
    expect(Object.values(report.cron).every((j) => !j.stale)).toBe(true);
    expect(healthHttpStatus(report)).toBe(200);
    delete process.env["OPERATOR_URL"];
  });

  it("is down (503) when the database query fails", async () => {
    process.env["OPERATOR_URL"] = "https://operator.example";
    const c = mockClient([], true);
    const report = await buildHealthReport(c as never, NOW, okFetch);
    expect(report.status).toBe("down");
    expect(report.db.ok).toBe(false);
    expect(healthHttpStatus(report)).toBe(503);
    delete process.env["OPERATOR_URL"];
  });

  it("is down (503) when the operator does not answer", async () => {
    process.env["OPERATOR_URL"] = "https://operator.example";
    const c = mockClient([...heartbeatRows]);
    const report = await buildHealthReport(c as never, NOW, deadFetch);
    expect(report.status).toBe("down");
    expect(report.operator.ok).toBe(false);
    expect(healthHttpStatus(report)).toBe(503);
    delete process.env["OPERATOR_URL"];
  });

  it("is down (503) when OPERATOR_URL is missing in a deployed env", async () => {
    delete process.env["OPERATOR_URL"];
    const c = mockClient([...heartbeatRows]);
    const report = await buildHealthReport(c as never, NOW, okFetch);
    expect(report.status).toBe("down");
    expect(report.operator.detail).toContain("OPERATOR_URL");
  });

  it("is down (503) when a messaging-critical cron has never run", async () => {
    process.env["OPERATOR_URL"] = "https://operator.example";
    const rows = heartbeatRows.filter((r) => r.job !== "heartbeat:outbox");
    const c = mockClient([...rows]);
    const report = await buildHealthReport(c as never, NOW, okFetch);
    expect(report.cron["outbox"]!.stale).toBe(true);
    expect(report.status).toBe("down");
    expect(healthHttpStatus(report)).toBe(503);
    delete process.env["OPERATOR_URL"];
  });

  it("is degraded (200) when only a daily cron is stale", async () => {
    process.env["OPERATOR_URL"] = "https://operator.example";
    const rows = heartbeatRows.map((r) =>
      r.job === "heartbeat:milestones" ? { ...r, updated_at: minutesAgo(60 * 40) } : r,
    );
    const c = mockClient([...rows]);
    const report = await buildHealthReport(c as never, NOW, okFetch);
    expect(report.cron["milestones"]!.stale).toBe(true);
    expect(report.status).toBe("degraded");
    expect(healthHttpStatus(report)).toBe(200);
    delete process.env["OPERATOR_URL"];
  });
});

describe("recordCronHeartbeat", () => {
  it("replaces the job's heartbeat row with the current time", async () => {
    const c = mockClient([
      { job: "heartbeat:outbox", last_tenant: null, updated_at: minutesAgo(60) },
      { job: "revenue-employee", last_tenant: "r-9", updated_at: minutesAgo(5) }, // watermark untouched
    ]);
    await recordCronHeartbeat(c as never, "outbox", NOW);
    const hb = c.store.filter((r) => r["job"] === "heartbeat:outbox");
    expect(hb).toHaveLength(1);
    expect(hb[0]!["updated_at"]).toBe(NOW.toISOString());
    expect(c.store.some((r) => r["job"] === "revenue-employee" && r["last_tenant"] === "r-9")).toBe(true);
  });

  it("never throws when the table is unreachable", async () => {
    const c = mockClient([], true);
    await expect(recordCronHeartbeat(c as never, "outbox")).resolves.toBeUndefined();
  });
});
