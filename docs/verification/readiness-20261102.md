# Flavourly readiness, 2 November 2026

This is a scoped engineering review, not an independent certification. Local tests do not prove production database migrations, account limits or delivery.

## Live evidence

- Fresh synthetic A/B signup and returning login, saved restaurant/menu and read-only cross-tenant isolation were checked this morning. No real customer data used.
- Menu sold-out toggle persists and the public guest menu displays the sold-out state. One saved synthetic dish costs R49.
- Approved code-only usage fix 89bba24 published. At08:58 SAST, fresh synthetic A login showed monthly0/500, daily0/25, trial0/100. No messages/charges made.
- At09:11, public health returned503: database reachable; outbox09:10, reminders09:00, lifecycle09:07 and milestones08:00 SAST recorded. Revenue Employee has no observed natural run yet. Its next scheduled verification is3Nov07:35 after07:30 run; manual run cancelled by owner.
- Health still depends on legacy OPERATOR_URL, while current WhatsApp code uses the new inbox provider. Legacy operator unreachable is not evidence of the new provider's health. Do not turn this green without checking real dependencies.
- At09:10, public Contact route offered no working enquiry action. This candidate replaces it with approved business email/phone links. Customer chooses whether to send/call; app sends nothing.
- At09:13, synthetic owner normal workspace export failed closed. No partial export, no deletion attempted. Production privacy RPC setup/access remains unverified.
- Market, waitlist and social routes render truthful empty states for synthetic A. Rendering is not feature acceptance.

## Prepared candidate scope

- Truthful saved menu summary on Today, without invented operating/revenue data.
- Shared conditional messaging-charge notice, with pilot no automatic overage.
- Business contacts ai-solutions@nahalabs.co.za and0612980377 only.
- Explicit menu/inbox/billing load errors instead of fake emptiness or blank page.
- Manager-only read-only activation status: switches, key-presence booleans, linked account and allowance RPC readiness. Never returns secrets or calls external providers.
- Fail closed before sends if allowance RPC unavailable. This does not replace atomic database reservation acceptance.
- Outbox provider failures/timeouts held after one attempt; no automatic retry that could duplicate an ambiguous send.
- AI budget errors/empty count fail closed rather than allowing unmetered provider calls.
- Campaign/waitlist copy describes the replies-only/activation boundary.

## Remaining gates and decisions

1. **Production allowance migration.** Actual privileged usage RPC returned PGRST202 at08:51. Code-only display works, but the new atomic reserve logic is not proven installed. Need approved privileged database route to inspect and apply exact missing functions, then verify ACLs and concurrent limits. Never grant browser execution. No DB migration is in this candidate.
2. **Privacy export/delete.** Export failed live. Need exact privileged error/schema check and supported migration route. Deletion remains untested live, must use disposable tenant only with explicit permission. Backup/restore and retention execution also unverified.
3. **WhatsApp activation.** Live switch values/key presence will be visible after candidate publish. Shared provider free capacity, actual account contracts, secure connect return/binding, signed inbound webhook, tenant A/B routes, STOP, staff handoff, reservation capacity, delivery receipts and disconnect/recovery need an approved dedicated test number and verified no-cost scope. No effect switch changes included.
4. **AI and voice.** Key presence is not model availability, free quota or output acceptance. Groq drafting, fallback, voice provider/model, prompt-injection resistance and cost caps need approved live tests. Current voice model availability not verified. No provider calls included.
5. **Billing contract mismatch.** Public plans999/1500/2900 and legacy PayFast contracts499/1499/3999/7999/19999 differ. Preserve existing contracts and webhook expected amounts; do not silently remap. Self-serve checkout remains hard-paused. New plan IDs/contract version, sandbox subscribe/ITN/replay/cancel/past-due and an agreed commercial offer are required before paid checkout.
6. **Additional features.** Real booking/reminder, loyalty/paid-visit ledger, reward redemption/GPS soft control, complaint recovery, consent and review-link queue, approval workflow, social publishing, competitor data collection and Revenue Employee results still need workflow-level production acceptance. No real financial refund, review request, social post or message test authorized by this candidate.
7. **Alerts and observability.** Real owner alert receipt and analytics/transactional mail receipt unverified. Logs are not delivery. Health's stale operator dependency and raw public DB-error detail need a separately tested health contract, not a fake green status.
8. **Identity and recovery.** Owner roles tested locally; live staff membership/role denial and app account recovery mail not proven. No password changes/reset authorized. Google owner-editor sign-in remains frozen.
9. **Operational scale.** No1000-restaurant load test, real provider throughput acceptance, restore rehearsal, independent external reviewer, physical midrange Android/slow-network test or security penetration test performed. CI and local mocks cannot substitute.
10. **Hosting.** Current Lovable URL and badge remain. Custom domain/badge removal may need a paid plan; free-only instruction stands. No hosting migration or purchase included.

## Honest release claim

Menu workspace and synthetic signup/sign-in/billing display are stranger-tested. This candidate improves safe pilot operation and transparency. It does not make the whole automation product production-accepted or guarantee "big-tech level". Do not send a blanket completion phrase while gates remain.
