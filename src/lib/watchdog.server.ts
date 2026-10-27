import { sendAlert } from "./alert.server";
import { db } from "./db.server";
import { evaluateHealth, type HealthCheck } from "./health.server";
import { recordHeartbeat } from "./heartbeat.server";

const ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Durable throttle: one alert per problem per window, even across serverless isolates. */
async function shouldAlert(name: string): Promise<boolean> {
  const c = await db();
  const key = `alert:${name}`;
  const { data } = await c.from("system_heartbeats").select("last_alert_at").eq("name", key).maybeSingle();
  const last = data?.last_alert_at ? new Date(data.last_alert_at as string).getTime() : 0;
  if (Date.now() - last < ALERT_WINDOW_MS) return false;
  await c.from("system_heartbeats").upsert({ name: key, last_run_at: new Date().toISOString(), last_alert_at: new Date().toISOString() }, { onConflict: "name" });
  return true;
}

export async function runWatchdog() {
  const report = await evaluateHealth();
  const failing: HealthCheck[] = report.checks.filter((check) => !check.ok);
  let alerted = 0;
  for (const check of failing) {
    if (await shouldAlert(check.name)) {
      await sendAlert({
        key: `watchdog:${check.name}`,
        severity: check.critical ? "critical" : "warning",
        title: `${check.name} is failing`,
        detail: check.detail,
      });
      alerted += 1;
    }
  }
  await recordHeartbeat("watchdog", true, `${failing.length} failing`);
  return { status: report.status, failing: failing.map((check) => check.name), alerted };
}
