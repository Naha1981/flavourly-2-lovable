# Owner Checklist — Required Before Handover

Every item below requires evidence. The coding agent cannot verify these from repository code alone. Do not check a box until the expected result exists and its link/date is recorded.

## 1. Production deployment and secrets

- [ ] **Set safe auth configuration.** In the actual production host/Lovable environment settings, set `REQUIRE_AUTH=true`, `ALLOW_INSECURE_DEMO=false`, and the exact production `PUBLIC_APP_URL` with HTTPS. Review every variable read by the app; set required variables for the services actually enabled.
  - **Pass:** deployment environment settings captured as a redacted screenshot or configuration export; a no-session dashboard server-function test returns 401; an authenticated Restaurant A user cannot access Restaurant B and gets 403.
- [ ] **Verify PayFast mode and configuration.** Confirm sandbox/live merchant ID, merchant key, passphrase, source IP list and notify URL in the PayFast merchant dashboard. Use matching credentials for the chosen mode. Production must have `PAYFAST_SANDBOX=false` only after the sandbox lifecycle passes.
  - **Pass:** redacted settings evidence; test ITN is accepted only after signature and postback validation; PayFast transaction appears once in the ledger; no raw secret value is attached to evidence.
- [ ] **Rotate exposed credentials.** Review all docs, chats, issues, workflow logs and Git history. Rotate every true secret that may have been exposed (PayFast passphrase/key, service-role key, operator key, webhook secret, Gemini/AI keys, cron secret). Changing/deleting Git files alone does not invalidate leaked credentials.
  - **Pass:** owner records which providers were rotated and date; full-history Gitleaks scan has a clean report or each finding is remediated/marked as an approved non-secret false positive. Link the scan output.
- [ ] **Check Supabase Auth settings.** In the production Supabase dashboard, enable email confirmation as required by the client, enable leaked-password protection, set exact redirect/site URLs, remove unused auth providers and review session settings.
  - **Pass:** redacted dashboard evidence and a tested sign-up/sign-in/confirmation/redirect flow.
- [ ] **Confirm account ownership and recovery.** Ensure the client/business can access GitHub, Lovable, Supabase, PayFast, WhatsApp operator, Google/Gemini, hosting, scheduler and monitoring. Document who owns each account and who can reset access.
  - **Pass:** client has tested access or a signed transfer/recovery plan exists; owner's personal account is not the only recovery route.

## 2. Cron jobs and operations

- [ ] **Schedule all five protected routes.** Configure in the chosen scheduler (Lovable Cloud, Supabase scheduling or an approved external scheduler). Every job must use POST and `Authorization: Bearer <LOVABLE_CRON_SECRET>`.
  - Suggested initial cadence: outbox every 1–2 minutes; reminders every 5 minutes; customer lifecycle daily; milestones daily; Revenue Employee daily at an agreed quiet time. Confirm cadence and cost with the client before enabling.
  - **Pass:** each scheduler job has a recorded endpoint/cadence, last successful run, HTTP 200, and one expected database side effect; repeat run does not duplicate side effects.
- [ ] **Verify operator connectivity per tenant.** Link the client's chosen WhatsApp number using the agreed QR/pairing flow and confirm status after refresh; test an inbound webhook and a controlled outbound message with the client.
  - **Pass:** the guest message appears once, a reply is logged, the client sees connected status, and no QR/pairing/session secrets are retained in tickets.
- [ ] **Choose and test an owner alert destination.** Wire email or WhatsApp alerts for payment ITN failure, outbox failure threshold, cron missed, tenant operator disconnect, health endpoint failure and error-rate spike.
  - **Pass:** deliberately trigger each condition once in staging; owner receives each alert, can identify tenant/route/request/time, and no guest message body, phone number or token appears.
- [ ] **Check health/status visibility.** Verify the deployed dashboard shows WhatsApp connectivity, last outbound message, billing status and a plain-language dependency issue. Confirm a health endpoint reports database/operator/cron health.
  - **Pass:** each status corresponds to the actual dependency and a deliberately failed staging dependency returns non-200 from the health endpoint. This is currently not evidenced and may require further development.

## 3. Payments, data, backups and acceptance

- [ ] **Run PayFast sandbox lifecycle.** Subscribe → valid ITN → active → cancel → canceled → failed payment → past_due; test duplicate ITN, wrong signature, tampered amount/tenant, and out-of-order notifications.
  - **Pass:** saved test run/evidence shows each transition and duplicate/stale messages are no-ops; transaction states match PayFast. The current automated tests are unit-level and do not replace this sandbox evidence.
- [ ] **Run one approved live small-value payment/refund.** Arrange a client-approved, PayFast-compliant low-value live test that does not change the app's published plan prices or quotas; record completion and refund in PayFast. If the existing subscription minimum makes this impossible without a product/pricing decision, stop and request owner approval rather than editing tier prices.
  - **Pass:** matching PayFast live record and refund record, with transaction references redacted for general documentation.
- [ ] **Clean Supabase replay.** From a clean scratch Supabase project, run `supabase db reset` (or the approved clean migration workflow) and attach the command and successful output. Confirm generated DB types using the supported generator after the schema is final.
  - **Pass:** clean reset exits 0; all migrations replay in order; generated types are committed by the supported generation process and `db()` type-checks without an unchecked cast.
- [ ] **Backup / restore rehearsal.** Check actual Supabase backup/PITR plan and retention in the dashboard. Follow the documented restore procedure on a disposable project or rehearse a backup restore from a timestamped backup.
  - **Pass:** owner records the backup/PITR level, restore-point timestamp, elapsed recovery time, and integrity checks. Never rehearse against production data destructively.
- [ ] **Client acceptance.** Run [ACCEPTANCE_SCRIPT.md](ACCEPTANCE_SCRIPT.md) in staging on a mid-range Android phone and slow connection profile with the restaurant manager.
  - **Pass:** every test is Pass (not skipped/not supported), evidence is linked, and both owner and client have signed the script for the tested commit/deploy.
- [ ] **Support terms are written.** Agree response times, channels, what counts as bug vs change request, maintenance price, third-party outage responsibility, after-hours emergency handling, data export/deletion terms and support expiry.
  - **Pass:** signed agreement or accepted written terms are stored in the client's agreed record system.

## Final owner decision

Do not approve handover while a security, payment, messaging, recovery or acceptance step remains unchecked. If a step needs a client-visible behaviour change, settle that decision explicitly before the implementation is merged.
