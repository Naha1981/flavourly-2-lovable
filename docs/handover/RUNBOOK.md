# Runbook

**Important:** This runbook documents triage steps; it does not mean alert delivery has been implemented or tested. Alert wiring and a deliberate alert-trigger test for every condition remain open.

## First response to a reported problem

1. Record the approximate time (South Africa time, SAST/UTC+2), affected restaurant slug, route/action, and request ID if available. Do not record guest message content, phone numbers, bearer tokens, or secrets in support notes.
2. Check the current GitHub Actions result and hosting/provider status pages.
3. Identify whether the fault is in the app, Supabase, PayFast, the WhatsApp operator, the model provider, or the scheduler.
4. Do not rerun a payment, queue a campaign, or replay an inbound webhook repeatedly until idempotency and current state are checked.
5. If there is a possibility of cross-tenant exposure, forged billing, secret exposure, or unintentional bulk messaging, disable the affected integration / scheduler using the provider dashboard and escalate immediately. Preserve logs with secrets and personal data redacted.

## Alert runbook

### PayFast ITN rejected or not applied

**Meaning:** The webhook was rejected by configuration, signature, source IP, amount/reference validation, PayFast's validation postback, or the database apply function.

**Confirm:** Inspect hosting logs for the request time and generic rejection reason. Check that `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX`, `PAYFAST_ALLOWED_IPS`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are set in the correct environment. Confirm the source-IP list from PayFast's current official instructions, the Cloudflare host target, and whether the matching sandbox/live credentials were used.

**Fix:** Correct the secret/configuration through the hosting dashboard, then retry only with a known sandbox transaction. Do not manually set a subscription to active to get around a failed ITN. A production payment state change requires checking the PayFast transaction in the merchant account and a record in the ITN ledger.

**Escalate:** If the event has an invalid signature, mismatched tenant/amount, unknown payment ID, or conflicting event state.

### Outbox send failures / messages not delivered

**Meaning:** A queued WhatsApp job failed, is delayed by quiet hours, hit a quota/opt-out check, or could not reach the operator.

**Confirm:** Check Campaigns/Inbox/WhatsApp health if available; inspect the restaurant's `outbox_jobs` status and last error in Supabase using an authorized admin path. Verify the job's tenant, status, attempts, next scheduled time, and whether it is automated. Do not expose message bodies or destination numbers in incident logs.

**Fix:** Check the operator dashboard and hosting status first. After it is available, use the supported retry mechanism for failed jobs or webhook events. The retry cap currently targets three real send failures; cold-start errors are rescheduled without incrementing attempts. Do not reset the account or resend a marketing campaign without checking opt-outs and duplicate status.

**Escalate:** If a job is silently stuck, a retry would duplicate a message, more than a few jobs fail at once, or quota/opt-out policy appears bypassed. Alert thresholds are not currently evidenced.

### Cron job missed / campaign or reminder stuck

**Meaning:** One of the five protected cron routes may not be scheduled or its request failed.

**Confirm:** In the scheduler dashboard, inspect the job's last run, status, response code and duration. Routes and suggested starting cadence:
- `POST /api/public/cron/outbox`: every 1–2 minutes.
- `POST /api/public/cron/reminders`: every 5 minutes (also runs post-visit feedback requests).
- `POST /api/public/cron/customer-lifecycle`: daily.
- `POST /api/public/cron/milestones`: daily.
- `POST /api/public/cron/revenue-employee`: daily at a quiet time, unless the business explicitly chooses another cadence.

These are recommendations, not evidence that the schedules exist. Each request requires `Authorization: Bearer <LOVABLE_CRON_SECRET>`.

**Fix:** Correct the scheduler URL, POST method, secret, timezone, and cadence. Trigger one authenticated run and confirm a successful HTTP response plus expected database effects.

**Escalate:** If the scheduler has no history, jobs fail repeatedly, or running a job could trigger an excessive number of sends / AI calls.

### WhatsApp operator disconnected / inaccessible

**Meaning:** A tenant's linked WhatsApp connection or the central operator is not healthy.

**Confirm:** Check the central operator dashboard first, then tenant-specific WhatsApp health and latest webhook delivery. Confirm `OPERATOR_URL`, `OPERATOR_API_KEY`, tenant token persistence, webhook URL and `WEBHOOK_SECRET`.

**Fix:** Restore the operator service first. If a particular number needs relinking, the restaurant owner should perform the QR/pairing flow in the dashboard. Never ask the restaurant to post a QR code, pairing code, token, or session credential in a ticket.

**Escalate:** If several tenants disconnect at once, the wrong tenant's account is shown, or a reset/disconnect might affect a customer number.

### Health check failing / database unreachable

**Meaning:** The app cannot reach a dependency or no health-check endpoint is present / healthy.

**Confirm:** `GET /api/health` reports database reachability, operator reachability and per-cron last-run ages, and returns 503 when the database, the operator, or a messaging-critical cron (outbox, reminders) is down or stale. Cron heartbeats are recorded in `cron_state` rows keyed `heartbeat:<job>` after each successful run. Point an external uptime monitor at `/api/health`; non-200 means act. Then check hosting logs and Supabase service status; verify the server-only Supabase URL/service-role key, public URL, and latest migration state.

**Fix:** Restore the dependency or correct its secret via the hosting dashboard. Avoid repeated deploys until the specific failure is known.

**Escalate:** When production schema and migration history disagree, the admin key was rotated/lost, or a recovery would modify existing data.

### Error-rate spike / server errors

**Meaning:** A route started failing or the shared app infrastructure may be unhealthy.

**Confirm:** Capture route, timestamp, tenant ID and request ID only; logs must not retain guest message bodies, phone numbers, authorization values, API keys or raw tokens. Compare against the latest deploy.

**Fix:** If tied to a recent safe code change, roll back using the documented host deployment workflow to the last known-good commit. Database migrations cannot generally be rolled back by reverting application code; follow the schema recovery steps first.

**Escalate:** Any data exposure, unexplained payment state change, repeated unhandled rejection, or possible credential compromise.

## Incident closure checklist

- Cause and affected time window recorded without guest PII/secrets.
- No tenant cross-over or duplicate billing/message effect found.
- Fix is in a new commit and CI is green.
- If a secret may have leaked, rotate it and review provider audit logs.
- Record whether a test was added and link the run.
- Inform the restaurant in plain language if its workflow was affected.
