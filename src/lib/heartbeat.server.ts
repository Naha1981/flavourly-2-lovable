import { sendAlert } from "./alert.server";
import { db } from "./db.server";

export async function recordHeartbeat(name: string, ok: boolean, detail?: string): Promise<void> {
  try {
    const c = await db();
    await c.from("system_heartbeats").upsert(
      { name, last_run_at: new Date().toISOString(), last_ok: ok, last_detail: (detail ?? "").slice(0, 300) || null },
      { onConflict: "name" },
    );
  } catch (error) {
    // Monitoring must never break the job it observes.
    console.error("heartbeat write failed", name, error instanceof Error ? error.message : error);
  }
}

/** Wraps a cron job: records success/failure for the watchdog and alerts if it throws. */
export async function runCronJob<T>(name: string, job: () => Promise<T>): Promise<Response> {
  try {
    const result = await job();
    await recordHeartbeat(name, true);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await recordHeartbeat(name, false, message);
    await sendAlert({ key: `cron:${name}`, severity: "critical", title: `Scheduled job "${name}" crashed`, detail: message });
    return Response.json({ ok: false, error: "Job failed." }, { status: 500 });
  }
}
