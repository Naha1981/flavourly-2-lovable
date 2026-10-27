# Runbook: when something breaks

Alerts arrive at `ALERT_WEBHOOK_URL` (a phone push if you use an ntfy.sh topic). The same checks are visible any time at `GET /api/public/health` (HTTP 503 = something critical is down). Point a free external monitor (UptimeRobot, BetterStack) at that URL as a second line of defence: if the app itself is down, nothing inside it can alert you.

**First move for any alert:** open `/api/public/health`, find the failing check, then follow its section below.

## Scheduled jobs (they must exist; nothing in the repo starts them)

| Job | Endpoint | Run every | Alert if silent for |
|---|---|---|---|
| outbox (sends queued messages) | `POST /api/public/cron/outbox` | 2 min | 10 min (**critical**) |
| reminders (+ feedback requests) | `POST /api/public/cron/reminders` | 15 min | 60 min |
| customer-lifecycle | `POST /api/public/cron/customer-lifecycle` | hourly | 3 h |
| milestones | `POST /api/public/cron/milestones` | daily | 36 h |
| revenue-employee | `POST /api/public/cron/revenue-employee` | daily | 36 h |
| watchdog (raises the alerts) | `POST /api/public/cron/watchdog` | 5 min | n/a |

All require `Authorization: Bearer <LOVABLE_CRON_SECRET>`. If Lovable Cloud does not schedule them for you, use `cron.sql` in this folder. Test one by hand:

```sh
curl -i -X POST https://YOUR-APP/api/public/cron/outbox -H "Authorization: Bearer $LOVABLE_CRON_SECRET"
```
Expect `200 {"ok":true,...}`. `401` = wrong secret. `500 Server configuration error` = `LOVABLE_CRON_SECRET` not set on the app.

## Alert / check → what to do

| Check | Meaning | Fix |
|---|---|---|
| `database` | App cannot query Supabase | Check Supabase status and project paused/over quota. Free-tier projects pause after inactivity: restore in the dashboard. |
| `config` | A required environment variable is missing | Set it (see `ENVIRONMENTS.md`) and redeploy. |
| `cron:<job>` never ran / stale | The scheduler is not calling the job, or the job fails | Run the curl above. 401: secret mismatch (re-set the scheduler's secret). 500 with an alert "job crashed": read the alert detail, then the app logs. Check `select * from cron.job_run_details order by start_time desc limit 20;` if using pg_cron. |
| `outbox:overdue` | Messages are queued past their send time | Usually the outbox cron is not running (above), or WhatsApp is disconnected, or the restaurant's plan is paused. |
| `outbox:stuck` | A run crashed mid-send; jobs are marked failed, not retried (to avoid double-messaging guests) | Review failed jobs for that restaurant and re-send manually if needed. |
| `outbox:failures` | Many sends failed in an hour | Open the restaurant's WhatsApp health page: disconnected number or operator down is the usual cause. |
| `whatsapp:webhook_failures` | Incoming guest messages are failing to save | Open WhatsApp health, use "retry" on failed events; check the alert for the error text. |
| "PayFast notification rejected" | A payment notification failed verification | See *Payments* below. |
| "Revenue agent failed for N restaurants" | The AI agent errored for some restaurants | Safe to ignore once; if repeated, open the alert detail. |
| "Revenue agent hit its 100-restaurant limit" | More than 100 restaurants; the rest are skipped | Paginate `src/routes/api/public/cron/revenue-employee.ts`. |

## Payments

- **Rejected notification, live mode:** common causes are `PAYFAST_PASSPHRASE` not matching the one set in PayFast, `PAYFAST_ALLOWED_IPS` out of date (PayFast changed its IP ranges), or the amount not matching the plan price. The alert text says which.
- **Restaurant paid but is not active:** find the payment in the PayFast dashboard, check `select * from billing_events where tenant_id = '...'`; if there is no row the notification never verified. After fixing the cause, use PayFast's "resend ITN".
- **Cancel failed:** the app deliberately does NOT mark the restaurant cancelled if PayFast refused, so they are not billed while shown as cancelled. Cancel in the PayFast dashboard, then retry.

## Rotating secrets

| Secret | How |
|---|---|
| `LOVABLE_CRON_SECRET` | Set the new value as `LOVABLE_CRON_SECRET` and the old as `LOVABLE_CRON_SECRET_PREVIOUS`, update the scheduler, redeploy, then clear `_PREVIOUS`. |
| `WEBHOOK_SECRET` | Change in the app and on the WhatsApp operator at the same time; webhooks fail between the two changes, so do it in a quiet hour and retry failed events afterwards. |
| `PAYFAST_PASSPHRASE` | Change in PayFast and the app together; expect rejected notifications in between. |
| Supabase service-role key | Rotate in Supabase, update the app env, redeploy. |

## Rolling back a bad release

Revert the commit on `main` with `git revert <sha>` (never force-push or rewrite history: Lovable syncs from it). Database migrations are not reverted automatically: write a new forward migration.

## Restoring data

Supabase backups (daily on paid plans; point-in-time recovery is an add-on) are the only copy that matters. Confirm the plan's backup setting in the dashboard (see `OWNER_CHECKLIST.md`) and rehearse one restore into a scratch project before relying on it. A new environment can be rebuilt from the repo with `scripts/replay-migrations.sh`; restoring data is separate.
