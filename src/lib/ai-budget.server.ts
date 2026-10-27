/**
 * Per-tenant AI cost caps (Definition of Done, Gate D). Every tenant-scoped
 * LLM/Gemini path must pass through assertAiBudget before calling the
 * provider. The counter is a daily atomic increment in ai_usage_counters;
 * crossing FLAVOURLY_AI_DAILY_CALLS_PER_TENANT (default 200) refuses the call
 * and raises a warning alert so the owner hears about the runaway tenant.
 *
 * Failure policy: a metering error (missing table/rpc, DB hiccup) fails OPEN
 * with a logged error - metering must never take down guest-facing flows; the
 * health check and alerts are the detection layer for that case.
 */
import { sendAlert } from "./alerts.server";
import { db } from "./db.server";

export class AiBudgetExceeded extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly calls: number,
    public readonly limit: number,
  ) {
    super("Daily AI usage cap reached for this restaurant (" + calls + "/" + limit + "). Try again tomorrow.");
    this.name = "AiBudgetExceeded";
  }
}

export function aiDailyLimit(): number {
  return Number(process.env["FLAVOURLY_AI_DAILY_CALLS_PER_TENANT"] || 200) || 200;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

export async function assertAiBudget(
  tenantId: string,
  scope: string,
  client?: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
): Promise<void> {
  const limit = aiDailyLimit();
  try {
    const c = client ?? (await db());
    const { data, error } = await c.rpc("bump_ai_usage", { p_tenant_id: tenantId, p_day: todayUtc() });
    if (error) {
      console.error("[ai-budget] metering failed for", tenantId, scope, error.message);
      return;
    }
    const calls = Number(data);
    if (Number.isFinite(calls) && calls > limit) {
      await sendAlert(
        "ai-budget:" + tenantId,
        "warning",
        "AI daily cap reached for " + tenantId,
        scope + " pushed the restaurant to " + calls + " AI calls today (cap " + limit + "). Further calls are refused until tomorrow (UTC).",
      );
      throw new AiBudgetExceeded(tenantId, calls, limit);
    }
  } catch (error) {
    if (error instanceof AiBudgetExceeded) throw error;
    console.error("[ai-budget] metering error for", tenantId, scope, error);
  }
}
