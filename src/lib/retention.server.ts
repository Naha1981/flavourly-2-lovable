/**
 * Opt-in, disabled-by-default retention sweeps.
 *
 * Safety contract:
 * - Nothing runs unless RETENTION_ENABLED=true.
 * - Even then, RETENTION_DRY_RUN defaults to true: rows are counted, never
 *   deleted, until the owner explicitly sets RETENTION_DRY_RUN=false.
 * - Every table needs its own window env (RETENTION_<TABLE>_DAYS); a table
 *   without a window is skipped. There are no built-in default windows.
 * - Deletes are batched (RETENTION_BATCH, default 500, max 1000) and limited
 *   to an allowlisted set of history tables.
 * - Nothing in the repo schedules this. Wiring it to a schedule is the
 *   owner's separate decision.
 */
import { db } from "./db.server";

export interface RetentionTableResult {
  table: string;
  windowDays: number;
  matched: number;
  deleted: number;
  dryRun: boolean;
}

export interface RetentionReport {
  enabled: boolean;
  dryRun: boolean;
  ranAt: string;
  tables: RetentionTableResult[];
  skipped: Array<{ table: string; reason: string }>;
}

const MAX_BATCH = 1_000;

const TARGETS = [
  { table: "wa_messages", envWindow: "RETENTION_WA_MESSAGES_DAYS", column: "created_at" },
  { table: "wa_webhook_events", envWindow: "RETENTION_WA_WEBHOOK_EVENTS_DAYS", column: "created_at" },
  {
    table: "outbox_jobs",
    envWindow: "RETENTION_OUTBOX_JOBS_DAYS",
    column: "created_at",
    terminalStatuses: ["sent", "failed"],
  },
] as const;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function retentionConfig() {
  const batchRaw = Number(env("RETENTION_BATCH"));
  const batch = Number.isFinite(batchRaw) && batchRaw > 0 ? Math.min(Math.floor(batchRaw), MAX_BATCH) : 500;
  return {
    enabled: env("RETENTION_ENABLED") === "true",
    dryRun: env("RETENTION_DRY_RUN") !== "false",
    batch,
    windows: TARGETS.map((t) => ({ ...t, days: Number(env(t.envWindow)) || null })),
  };
}

export async function runRetention(now: Date = new Date()): Promise<RetentionReport> {
  const cfg = retentionConfig();
  const report: RetentionReport = {
    enabled: cfg.enabled,
    dryRun: cfg.dryRun,
    ranAt: now.toISOString(),
    tables: [],
    skipped: [],
  };
  if (!cfg.enabled) {
    for (const t of TARGETS) report.skipped.push({ table: t.table, reason: "retention disabled" });
    return report;
  }

  const c = await db();
  for (const target of cfg.windows) {
    if (!target.days || target.days <= 0) {
      report.skipped.push({ table: target.table, reason: "no window configured" });
      continue;
    }
    const cutoff = new Date(now.getTime() - target.days * 86_400_000).toISOString();
    let query = c.from(target.table).select("id").lt(target.column, cutoff);
    if ("terminalStatuses" in target && target.terminalStatuses) {
      query = query.in("status", [...target.terminalStatuses]);
    }
    const { data, error } = await query.limit(cfg.batch);
    if (error) throw new Error("retention scan failed for " + target.table + ": " + error.message);
    const matched = (data ?? []).length;
    let deleted = 0;
    if (!cfg.dryRun && matched > 0) {
      const ids = (data ?? []).map((row) => row["id"]);
      const { error: deleteError } = await c.from(target.table).delete().in("id", ids);
      if (deleteError) {
        throw new Error("retention delete failed for " + target.table + ": " + deleteError.message);
      }
      deleted = matched;
    }
    report.tables.push({
      table: target.table,
      windowDays: target.days,
      matched,
      deleted,
      dryRun: cfg.dryRun,
    });
  }
  console.warn("[flavourly-retention]", JSON.stringify(report));
  return report;
}
