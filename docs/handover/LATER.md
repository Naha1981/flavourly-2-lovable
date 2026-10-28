# Later / Deferred Work

Items below are deferred, not acceptance criteria waived:

- Replace the direct Reply Drafter send with a conversation-scoped, logged outbox path (M3).
- Complete the manager-only role matrix and generated tenant authorization tests (M1/M6).
- Finish PayFast sandbox lifecycle recording, replay/out-of-order cases and live owner validation (H1/H2).
- Regenerate Supabase types using the supported generator and type `db()` (M5).
- Add rate limits/abuse controls on public claim lookup and redemption endpoints (Low).
- Review outbound URL/SSRF constraints and prompt-injection risks in external research / AI gateway code.
- Rehearse backup/PITR restore and document actual recovery time.
- Add the separate E2E package's lockfile and execute safe mobile/slow-network browser tests in CI.
- Build one health endpoint for DB, operator reachability and cron last-run times, plus plain-language dashboard status.
- Wire owner alerts and deliberately trigger each alert in a test environment; capture proof.
- Add per-tenant caps for LLM calls and Gemini sessions, in addition to existing daily Revenue Employee run limits.
- Review vendor/hosting ownership, contractual support SLA, data retention and POPIA-related operational policy.
- Verify Gemini Live model availability, provider quotas, and all optional provider endpoint settings.

## Per-tenant metering for triage and reply drafts

`triageMessage` and `generateReplyDraft` are reachable by any signed-in
dashboard user without a tenant binding, so they cannot be capped per tenant
yet. Thread `tenantId` through `analyseMessage`/`draftReply` (guard it) and
then route both through `assertAiBudget`.
