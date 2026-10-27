import { db } from "./db.server";

/** How often each scheduled job SHOULD run, and how stale a heartbeat may get before we call it down. See docs/handover/RUNBOOK.md. */
export const CRON_EXPECTATIONS: Record<string, { everyMinutes: number; maxAgeMinutes: number }> = {
  outbox: { everyMinutes: 2, maxAgeMinutes: 10 },
  reminders: { everyMinutes: 15, maxAgeMinutes: 60 },
  "customer-lifecycle": { everyMinutes: 60, maxAgeMinutes: 180 },
  milestones: { everyMinutes: 1440, maxAgeMinutes: 36 * 60 },
  "revenue-employee": { everyMinutes: 1440, maxAgeMinutes: 36 * 60 },
};

export const REQUIRED_ENV = ["WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_CRON_SECRET"] as const;

export type HealthCheck = { name: string; ok: boolean; critical: boolean; detail: string };
export type HealthReport = { status: "ok" | "degraded" | "down"; checks: HealthCheck[] };

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export async function evaluateHealth(): Promise<HealthReport> {
  const checks: HealthCheck[] = [];
  let c: Awaited<ReturnType<typeof db>>;
  try {
    c = await db();
    const { error } = await c.from("system_heartbeats").select("name").limit(1);
    checks.push({ name: "database", ok: !error, critical: true, detail: error ? "query failed" : "reachable" });
    if (error) return summarise(checks);
  } catch {
    checks.push({ name: "database", ok: false, critical: true, detail: "unreachable" });
    return summarise(checks);
  }

  const missing = REQUIRED_ENV.filter((key) => !(process.env[key] ?? "").trim());
  checks.push({ name: "config", ok: missing.length === 0, critical: true, detail: missing.length ? `missing: ${missing.join(", ")}` : "complete" });

  const { data: beats } = await c.from("system_heartbeats").select("name, last_run_at, last_ok");
  const byName = new Map((beats ?? []).map((b: { name: string; last_run_at: string; last_ok: boolean }) => [b.name, b]));
  for (const [name, expectation] of Object.entries(CRON_EXPECTATIONS)) {
    const beat = byName.get(name);
    const fresh = beat && new Date(beat.last_run_at).getTime() >= Date.now() - expectation.maxAgeMinutes * 60_000;
    checks.push({
      name: `cron:${name}`,
      ok: Boolean(fresh && beat.last_ok),
      critical: name === "outbox",
      detail: !beat ? "never ran" : !fresh ? `last ran ${beat.last_run_at}` : beat.last_ok ? "on schedule" : "last run failed",
    });
  }

  const overdue = await c.from("outbox_jobs").select("id", { count: "exact", head: true }).eq("status", "pending").lt("scheduled_for", minutesAgo(15));
  checks.push({ name: "outbox:overdue", ok: (overdue.count ?? 0) === 0, critical: true, detail: `${overdue.count ?? 0} overdue` });

  const stuck = await c.from("outbox_jobs").select("id", { count: "exact", head: true }).eq("status", "processing").lt("claimed_at", minutesAgo(10));
  checks.push({ name: "outbox:stuck", ok: (stuck.count ?? 0) === 0, critical: false, detail: `${stuck.count ?? 0} stuck` });

  const threshold = Number(process.env["ALERT_FAILED_SENDS_PER_HOUR"] ?? "5") || 5;
  const failed = await c.from("outbox_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", minutesAgo(60));
  checks.push({ name: "outbox:failures", ok: (failed.count ?? 0) < threshold, critical: false, detail: `${failed.count ?? 0} failed in the last hour` });

  const hooks = await c.from("wa_webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed").gte("received_at", minutesAgo(60));
  checks.push({ name: "whatsapp:webhook_failures", ok: (hooks.count ?? 0) < threshold, critical: false, detail: `${hooks.count ?? 0} failed in the last hour` });

  return summarise(checks);
}

function summarise(checks: HealthCheck[]): HealthReport {
  const criticalFail = checks.some((check) => check.critical && !check.ok);
  const anyFail = checks.some((check) => !check.ok);
  return { status: criticalFail ? "down" : anyFail ? "degraded" : "ok", checks };
}
