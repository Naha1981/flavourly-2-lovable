# Flavourly pre-launch verification, 1 Nov 2026

This is a developer review and test record, not an independent second-reviewer sign-off. No live signup, sign-in, customer email, WhatsApp send, paid template or spend was performed.

## Live checked 04:21-04:22 SAST
- Homepage, signup form, privacy page and pricing render in a real browser.
- Pricing live: Starter R999 / Growth R1499 / Pro R2900, seven-day no-card pilot, higher tiers conditional. This supersedes the checklist's stale R1500/Platinum wording and 'local only' status.
- `/api/health`: status down, cron_state absent from schema cache, old operator unreachable. This is not a healthy app behind a healthy homepage.
- Injected Edit with Lovable badge visible. Official hosting settings require paid plan for badge removal and custom domain. No upgrade or external-host cutover approved.
- Signup creation remains unverified under sign-in freeze, not proven disabled by a29Oct failure. Published pricing does not establish all schema or flags.

## Code review findings
1. FIXED locally: auth-client auth-config read failure returned false (fail-open UI). Now true. Server auth was independently fail-closed already.
2. FIXED locally: raw signup provider error shown to customers. Now fixed generic copy and safe event reason.
3. FIXED locally: existing analytics had app_opened but no signup/paid-visit events. Added start/completion and signup failure. Existing sanitizer blocks customer fields, URL/email/phone, raw error data; anonymous ID is session-scoped. Analytics is optional and never breaks product work. Live dashboard receipt remains unverified.
4. ADDED locally: default-OFF transactional welcome and paid-visit email to confirmed authenticated member only, membership check, no client-supplied destination, no guest/bill details, hashed idempotency header, atomic dedupe +20attempt/day shared pilot cap, no retries after ambiguous/provider failure. This is receipt code, not verified delivery. Verified sender/free-quota/live test approval required; no marketing.
5. Existing alerts use webhook and guarded WhatsApp; absent configuration is not delivery. Existing tests exercise failed/success transports; no actual owner receipt yet.
6. Public health includes raw database error details and uses deprecated OPERATOR_URL. Current failure is real missing cron schema plus stale dependency check. Full health redesign/config acceptance must not hide absent schema by returning green.
7. Privacy text promises workspace export/delete but Settings has no corresponding controls. Full POPIA acceptance is OPEN, not established by a policy page. Retention defaults dry-run. Contact inbox ownership/delivery not verified.
8. Existing paid-visit record function lacked callers, fixed by manager-only action in review build. It is manual settled-bill recording, not a POS/payment integration. No payment charge is made by that action.
9. Review trigger requires positive spend, explicit consent, venue flag defaultOFF; atomic claims, server-only queue/grants and opaque allowed-Google redirect. No review gating. Crash/ambiguity held rather than duplicate send.
10. Existing critical migrations are not applied live; service-only ACL/allowance proof remains blocked on Build credits. Never promote local SQL proof to live.

## Not accepted as complete
- Independent second-person/code-review pass, real stranger signup/tenant A/B journey and auth mail delivery.
- Live analytics dashboard event receipt, live transactional email receipt, error and downtime receipt.
- Payment sandbox end-to-end (public paid checkout intentionally paused).
- Backup restoration/live recovery, export/delete, full consent/retention operational check.
- Number connect/real route/review scheduling acceptance. All send/connect/AI/review/mail flags remainOFF.
- Custom domain and no hosted badge under free-only constraint; external-host option needs separate plan preserving database.
- Launch video: make only after the real accepted workflow, do not film fixture success as live proof.

## Local evidence
641tests, typecheck, environment and focus checks pass. Review SQL harness executes all migrations, validates atomic paid-review queue/claim/STOP/click/server-only rules. Notification mocks verify recipient/auth/gates/dedupe/failure behaviour only, not real mail. Synthetic authenticated product UI tests use actual server functions and database migrations; screenshots inspected desktop390px, no horizontal overflow. Bottom bar overlays a viewport strip during full-page mobile capture as it does in the existing app; content scroll remains available.
