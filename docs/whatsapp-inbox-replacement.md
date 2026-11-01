# WhatsApp inbox replacement - local candidate, 1 November 2026

Not deployed. No live account was connected and no provider or AI call was made.

## Route

Matches the RevUp receptionist provider path: hosted WhatsApp connect, tenant profile/account binding, signed message.received webhook, inbox conversation replies and Groq gpt-oss-120b with gpt-oss-20b fallback. This is a TypeScript adaptation to Flavourly, not a copy of its Django application. Flavourly retains its existing database; no Supabase edge function was added.

All three effect switches default off: WHATSAPP_CONNECT_ENABLED, WHATSAPP_SEND_ENABLED, WHATSAPP_AI_ENABLED. Credentials remain server-only. Connection enablement requires checking shared free account capacity. AI enablement requires confirming a no-card free account. Send enablement is a separate approval.

## Safety and workflows

- HMAC-SHA256 over raw webhook body, current and legacy provider headers.
- Account plus profile maps to tenant; incoming tenant hints ignored.
- Atomic event/message ingest and replay guard, tenant locking.
- Rolling atomic tenant budgets: 60 send attempts/hour, 300/day; 300 drafts/day. Failed/ambiguous requests consume budget conservatively.
- Only known incoming conversations under 24 hours can receive replies. No template endpoint. Campaign jobs refused. STOP checked at send time.
- Unknown account, mismatched tenant, invalid time, budget error and database error fail closed.
- Saved tenant menu facts only. Requests for manager, complaints and allergies pause AI for a human in the inbox. Assigned conversations stay with the human.
- Held send failures create approval requests, not automatic retry jobs.
- Booking confirmation uses a locked database capacity check. Blank capacity requires manager review. Two-hour occupancy; repeated YES is idempotent.
- Points use existing ledger. Visits and VIP read actual billed visits. Messages cannot award stamps/visits. Existing five-visit or R5,000 VIP rule retained. Added cross-tenant customer/ledger foreign key.
- Connection component no longer polls. WhatsApp health manual refresh only. Inbox no longer populates an empty live workspace with demo conversations or invented staff names.

## Verification

582 automated tests in 45 files passed. Typecheck, production build, environment and test-focus checks passed. Every migration applied to a fresh local PostgreSQL engine (PGlite), with actual SQL checks for budgets, replay, capacity, duplicate confirmations, recorded visits/VIP and tenant boundaries. Changed-file lint passed; full-repository lint still fails inherited formatting rules (see proof report).

Actual product onboarding screenshot and click test at desktop and 390px mobile: secure connect instructions, truthful unconnected state, paused connection feedback, no horizontal overflow. Logo fallback fixes unavailable hosted image asset.

These are local synthetic tests. They are not live delivery, live authentication, stranger testing or 100/100 independent acceptance. Database proof is not production Supabase proof. Authenticated settings/inbox were additionally tested against a synthetic local auth and PostgreSQL-backed fixture: saved capacity 16 from the actual settings screen, ingested a signed synthetic customer message, displayed manager handoff, assigned Manager from the product, and displayed Delivered only after a signed synthetic receipt. These are not real logins or deliveries. Provider-return flow still needs staging validation against real account contracts before launch.

## Free-only boundaries

Official pricing states first two social accounts free, 10,000 outgoing inbox messages/month shared across accounts, then charges. Non-template WhatsApp service replies within 24 hours are free. The app cannot know whether other apps have already consumed the shared allowance. Keep no payment method on the provider account, verify the account is on the free path, and leave effects off until that check is done. Per-tenant caps alone do not prove shared costs are zero.

Sources checked 1 November 2026:
- https://docs.zernio.com/webhooks
- https://docs.zernio.com/webhooks/whatsapp
- https://docs.zernio.com/multi-tenant/inbox
- https://zernio.com/pricing
- https://console.groq.com/docs/models

## Before any push or deployment

Obtain separate Go + Sure for this candidate, then apply/rehearse migration in staging, configure server secrets securely, verify real account/profile response shape and free allowance, test the hosted return and bind flow with one approved restaurant number, test signed incoming customer messages and delivery status, verify database permissions under Supabase, test staff handoff and capacity from authenticated product screens. Do not claim live delivery merely because the send API accepted a request. No password changes, resets, new services or paid usage are authorized by this candidate.


## Follow-up local acceptance

Added delivery receipt handling and visible Accepted/Sent/Delivered/Read/Failed labels. Provider sample/test webhooks are ignored. Standby messages are saved without taking control from a human. Account verification now requires explicitly active and not-needing-reconnection. Fresh local SQL checks also prove foreign-tenant receipts cannot change delivery state.

Deployment is currently blocked: the known Lovable project is live, with a built-in Supabase that must remain untouched. No isolated approved staging target/database is identified. Do not push main or apply migrations to that live backend as a shortcut. Existing provider-session allowance inspection failed before reading the site, so free connected-account slots remain unverified.

Additional contracts read:
- https://docs.zernio.com/accounts/list-accounts
- https://docs.zernio.com/webhooks/inbox
- https://docs.zernio.com/messages/send-inbox-message
