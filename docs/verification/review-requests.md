# Paid-visit review requests (local, paused)

Based on RepEngine's check-in/review/reminder lifecycle. No provider names on customer screens. No live sends, sign-ins, paid templates or new services.

- Trigger: successful idempotent `record_visit` paid-visit loyalty ledger insertion, positive spend, consent and venue gate. Existing bill reference prevents duplicate visit/review. It is not a bank/POS payment feed.
- App entry point: manager-only Record paid visit in Reputation. Records a settled bill and loyalty points, does not take payment. Explicit consent checkbox. Existing recordVisit had no callers.
- Default OFF: global REVIEW_AUTOMATION_ENABLED plus venue review_requests_enabled false, plus existing transport switch. Paused venues do not build a backlog. New migration required.
- 15min check-in, 2h after acceptance neutral honest review ask, one reminder 48h later. Opaque tracked HTTPS link, click cancels reminder but is not proof a review was posted. Google destination allowlist, no arbitrary redirect.
- Existing guarded sendText enforces linked venue account, opt-out, recent inbound (<24h), plan/trial/monthly/pilot allowances. Failed, ambiguous or expired sends held without retry; in-process crashes remain processing, never automatically resent. The 48h reminder normally needs a fresh inbound; otherwise held with no paid template.
- Atomic claim prevents overlapping workers sending twice. STOP database trigger cancels future steps. START never revives past work. A very late STOP/click can race an already-started provider request; accepted messages cannot be recalled.
- Ratings 1-3 become inbox manager handoffs and never suppress neutral review invitations. Free-text concerns still reach existing inbox/AI handoff. Legacy booking feedback runner retired and queued legacy feedback jobs cancelled by migration. Historical rating replies get the same Google invitation irrespective of score. No incentives conditional on reviews.
- Owner status shows paused/setup-pending and recent steps/errors. No in-app enable toggle, so separate acceptance and approval remain required.

## Local proof
631 tests pass; typecheck, focused ESLint, build, env/focus checks. SQL harness executes every migration and verifies paid trigger, bill dedupe, default OFF/no backlog, zero-spend/consent guards, token, atomic claim, click, STOP and server-only grants. Worker tests cover timing, default/global/venue/transport gates, failed sends, consent, clicks, expiry and secure destinations. Authenticated synthetic actual-product browser test records a paid visit through the real server function, confirms no queue while OFF, checks 390px and desktop. These are fixture credentials/data, not live acceptance. Screens visually inspected.

## Deployment dependencies
Prior grants and allowances migrations remain unverified/unapplied live. Do not bypass them. Add review migration only via a working approved owner migration path. Deploy/publish and database changes need separate quoted Go + Sure. Keep all automation and send switches OFF until real route acceptance and separately approved enablement. No link/review/customer sends were used for proof.
