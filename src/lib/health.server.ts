/**
 * Startup/health reporting (Definition of Done, Gate D): one endpoint reports
 * whether the database is reachable, whether the WhatsApp operator is
 * reachable, and when each cron job last completed. The route returns non-200
 * when something critical is down so an external uptime monitor (or the
 * owner) hears about breakage before the client does.
 *
 * Cron heartbeats are tiny rows in the service-role-only cron_state table
 * under the key `heartbeat:<job>`, written by recordCronHeartbeat after each
 * successful run. They share the table with the resumability watermarks and
 * degrade the same way: a missing row means "never observed", never a crash.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CronExpectation {
  /** Maximum acceptable age of the last successful run, in minutes. */
  staleAfterMinutes: number;
  /** Critical jobs take the whole endpoint down when stale. */
  critical: boolean;
}

/**
 * Expected cadences, from docs/handover/RUNBOOK.md ("Cron job missed").
 * Staleness windows are deliberately several times the cadence so a single
 * missed run pages nobody; a silently unscheduled job still surfaces within
 * the hour for messaging-critical jobs.
 */
export const CRON_EXPECTATIONS: Record<string, CronExpectation> = {
  outbox: { staleAfterMinutes: 10, critical: true },
  reminders: { staleAfterMinutes: 30, critical: true },
  "customer-lifecycle": { staleAfterMinutes: 60 * 36, critical: false },
  milestones: { staleAfterMinutes: 60 * 36, critical: false },
  "revenue-employee": { staleAfterMinutes: 60 * 36, critical: false },
};

const HEARTBEAT_PREFIX = "heartbeat:";

export async function recordCronHeartbeat(
  c: Pick<SupabaseClient, "from">,
  job: string,
  now: Date = new Date(),
): Promise<void> {
  try {
    // Single atomic upsert: a half-failed delete+insert pair used to leave the
    // heartbeat row missing entirely, which the health check then reported as
    // a critical "never ran" until the next successful run rewrote it.
    await c
      .from("cron_state")
      .upsert(
        { job: HEARTBEAT_PREFIX + job, last_tenant: null, updated_at: now.toISOString() },
        { onConflict: "job" },
      );
  } catch {
    // A lost heartbeat shows up as staleness on the health check; it must
    // never fail the cron run itself.
  }
}

export interface ComponentStatus {
  ok: boolean;
  detail: string;
}

export interface CronStatus {
  lastRun: string | null;
  ageMinutes: number | null;
  stale: boolean;
  critical: boolean;
}

export interface HealthReport {
  status: "ok" | "degraded" | "down";
  db: ComponentStatus;
  operator: ComponentStatus;
  cron: Record<string, CronStatus>;
  checkedAt: string;
}

async function checkDb(c: Pick<SupabaseClient, "from">): Promise<ComponentStatus> {
  try {
    const { error } = await c.from("cron_state").select("job").limit(1);
    if (error) return { ok: false, detail: "query failed" };
    return { ok: true, detail: "reachable" };
  } catch {
    return { ok: false, detail: "database unavailable" };
  }
}

/**
 * Require a successful health response. Authentication failures and server
 * failures are not healthy merely because the service answered.
 */
export async function checkOperator(fetchFn: typeof fetch = fetch): Promise<ComponentStatus> {
  const enabled =
    process.env["WHATSAPP_CONNECT_ENABLED"] === "true" ||
    process.env["WHATSAPP_SEND_ENABLED"] === "true";
  if (!enabled)
    return { ok: false, detail: "WhatsApp activation paused; provider delivery not verified" };
  const key = process.env["ZERNIO_API_KEY"];
  if (!key) return { ok: false, detail: "WhatsApp provider is not configured" };
  try {
    // Same current inbox provider as whatsapp.server.ts. Read-only, no account creation.
    const response = await fetchFn("https://zernio.com/api/v1/accounts", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      return { ok: false, detail: `provider account read returned HTTP ${response.status}` };
    const body = (await response.json()) as { accounts?: unknown };
    if (!Array.isArray(body.accounts))
      return { ok: false, detail: "provider account response could not be verified" };
    return {
      ok: true,
      detail: "provider account read reachable; delivery and free capacity not verified",
    };
  } catch {
    return { ok: false, detail: "current WhatsApp provider unavailable" };
  }
}

export async function buildHealthReport(
  c: Pick<SupabaseClient, "from">,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<HealthReport> {
  const [dbStatus, operatorStatus, heartbeats] = await Promise.all([
    checkDb(c),
    checkOperator(fetchFn),
    (async () => {
      try {
        const { data, error } = await c
          .from("cron_state")
          .select("job, updated_at")
          .like("job", HEARTBEAT_PREFIX + "%");
        if (error) return null;
        return data ?? [];
      } catch {
        return null;
      }
    })(),
  ]);

  const lastRunByJob = new Map<string, string>();
  for (const row of heartbeats ?? []) {
    const name = String(row.job).slice(HEARTBEAT_PREFIX.length);
    lastRunByJob.set(name, String(row.updated_at));
  }

  const cron: Record<string, CronStatus> = {};
  let criticalStale = false;
  let nonCriticalStale = false;
  for (const [job, expectation] of Object.entries(CRON_EXPECTATIONS)) {
    const lastRun = lastRunByJob.get(job) ?? null;
    const ageMinutes = lastRun
      ? Math.max(0, Math.round((now.getTime() - Date.parse(lastRun)) / 60000))
      : null;
    const stale = ageMinutes === null || ageMinutes > expectation.staleAfterMinutes;
    cron[job] = { lastRun, ageMinutes, stale, critical: expectation.critical };
    if (stale && expectation.critical) criticalStale = true;
    if (stale && !expectation.critical) nonCriticalStale = true;
  }

  // When the DB itself is down the cron rows are unreadable; report them as
  // unknown rather than falsely stale, the db component already says "down".
  const dbDown = !dbStatus.ok;
  const status: HealthReport["status"] =
    dbDown || !operatorStatus.ok || (!dbDown && criticalStale)
      ? "down"
      : nonCriticalStale
        ? "degraded"
        : "ok";

  return { status, db: dbStatus, operator: operatorStatus, cron, checkedAt: now.toISOString() };
}

/** HTTP status for the report: non-200 whenever anything critical is down. */
export function healthHttpStatus(report: HealthReport): number {
  return report.status === "down" ? 503 : 200;
}
