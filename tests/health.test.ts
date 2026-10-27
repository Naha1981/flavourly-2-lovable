import { beforeEach, describe, expect, it, vi } from "vitest";

type Scenario = {
  beats: Array<{ name: string; last_run_at: string; last_ok: boolean }>;
  overdue: number;
  stuck: number;
  failed: number;
  hooks: number;
  dbError: boolean;
};
let scenario: Scenario;

function from(table: string) {
  const filters: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, limit: self, lt: self, gte: self,
    eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
    then: (resolve: (value: unknown) => unknown) => {
      if (table === "system_heartbeats") return resolve(scenario.dbError ? { error: { message: "x" }, data: null } : { error: null, data: scenario.beats });
      if (table === "wa_webhook_events") return resolve({ count: scenario.hooks, error: null });
      const status = filters["status"];
      const count = status === "pending" ? scenario.overdue : status === "processing" ? scenario.stuck : scenario.failed;
      return resolve({ count, error: null });
    },
  });
  return chain;
}
vi.mock("@/lib/db.server", () => ({ db: async () => ({ from }) }));

const fresh = (name: string) => ({ name, last_run_at: new Date().toISOString(), last_ok: true });
const ALL = ["outbox", "reminders", "customer-lifecycle", "milestones", "revenue-employee"];

beforeEach(() => {
  scenario = { beats: ALL.map(fresh), overdue: 0, stuck: 0, failed: 0, hooks: 0, dbError: false };
  process.env["WEBHOOK_SECRET"] = "x";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "x";
  process.env["LOVABLE_CRON_SECRET"] = "x";
});

async function run() {
  const { evaluateHealth } = await import("@/lib/health.server");
  return evaluateHealth();
}
const failing = (r: Awaited<ReturnType<typeof run>>) => r.checks.filter((c) => !c.ok).map((c) => c.name);

describe("evaluateHealth", () => {
  it("is ok when everything is on schedule", async () => {
    const report = await run();
    expect(report.status).toBe("ok");
    expect(failing(report)).toEqual([]);
  });

  it("goes down when the database is unreachable", async () => {
    scenario.dbError = true;
    expect((await run()).status).toBe("down");
  });

  it("goes down when cron has never run for the outbox (jobs would never send)", async () => {
    scenario.beats = ALL.filter((n) => n !== "outbox").map(fresh);
    const report = await run();
    expect(report.status).toBe("down");
    expect(failing(report)).toContain("cron:outbox");
  });

  it("is only degraded when a non-critical job is stale", async () => {
    scenario.beats = ALL.map((n) => (n === "milestones" ? { ...fresh(n), last_run_at: new Date(Date.now() - 48 * 3600_000).toISOString() } : fresh(n)));
    const report = await run();
    expect(report.status).toBe("degraded");
    expect(failing(report)).toEqual(["cron:milestones"]);
  });

  it("goes down when queued messages are overdue", async () => {
    scenario.overdue = 4;
    const report = await run();
    expect(report.status).toBe("down");
    expect(failing(report)).toContain("outbox:overdue");
  });

  it("degrades on stuck jobs, a failure spike or webhook failures", async () => {
    scenario.stuck = 1; scenario.failed = 9; scenario.hooks = 7;
    const report = await run();
    expect(report.status).toBe("degraded");
    expect(failing(report)).toEqual(expect.arrayContaining(["outbox:stuck", "outbox:failures", "whatsapp:webhook_failures"]));
  });

  it("goes down when required configuration is missing", async () => {
    delete process.env["LOVABLE_CRON_SECRET"];
    const report = await run();
    expect(report.status).toBe("down");
    expect(failing(report)).toContain("config");
  });
});
