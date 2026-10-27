/**
 * Out-of-band alerts to the operator (a phone push, Slack, Discord, email-to-webhook...).
 *
 *   ALERT_WEBHOOK_URL     where to POST. Free options: an ntfy.sh topic URL, a Slack/Discord webhook.
 *   ALERT_WEBHOOK_FORMAT  "json" (default; sends {text, content, title, severity}) or "text" (plain body + Title header, for ntfy).
 *
 * Alerts must never contain guest phone numbers, message bodies, tokens or keys.
 * Callers pass short, already-sanitised strings.
 */
export type AlertSeverity = "critical" | "warning";

const recent = new Map<string, number>();
const THROTTLE_MS = 15 * 60 * 1000;

export function alertsConfigured(): boolean {
  return Boolean((process.env["ALERT_WEBHOOK_URL"] ?? "").trim());
}

export async function sendAlert(input: {
  key: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const url = (process.env["ALERT_WEBHOOK_URL"] ?? "").trim();
  console.error("[alert]", input.severity, input.title, input.detail ?? "");
  if (!url) return false;

  // Per-isolate flood guard; the watchdog adds a durable once-per-window throttle on top.
  const now = Date.now();
  const last = recent.get(input.key);
  if (last && now - last < THROTTLE_MS) return false;
  recent.set(input.key, now);

  const title = `[Flavourly ${input.severity}] ${input.title}`.slice(0, 200);
  const detail = (input.detail ?? "").slice(0, 800);
  const format = (process.env["ALERT_WEBHOOK_FORMAT"] ?? "json").toLowerCase();
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: format === "text" ? { Title: title, Priority: input.severity === "critical" ? "urgent" : "default" } : { "content-type": "application/json" },
      body: format === "text" ? detail || title : JSON.stringify({ text: `${title}\n${detail}`.trim(), content: `${title}\n${detail}`.trim(), title, severity: input.severity, detail }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch (error) {
    console.error("[alert] delivery failed", error instanceof Error ? error.message : error);
    return false;
  }
}
