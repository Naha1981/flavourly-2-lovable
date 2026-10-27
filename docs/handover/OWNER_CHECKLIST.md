# Owner checklist: things only a human with dashboard access can verify

Nothing here can be checked from the code. Do these before telling the client the app is complete.

## Production configuration
- [ ] `REQUIRE_AUTH` is no longer used. Confirm `ALLOW_INSECURE_DEMO` is **empty/unset** in production and `PUBLIC_APP_URL` is the real `https://` URL
- [ ] All variables in `ENVIRONMENTS.md` are set in production. `/api/public/health` reports `config: ok`
- [ ] `PAYFAST_SANDBOX=false`, live merchant id/key, **a passphrase set in PayFast and in the app**, `PAYFAST_ALLOWED_IPS` copied from PayFast's current ITN documentation
- [ ] The PayFast live notification URL is `https://YOUR-APP/api/public/billing/webhook`
- [ ] One real small payment completed and refunded; the tenant became active (see `billing_events`)
- [ ] **All six scheduled jobs exist and run** (`RUNBOOK.md`); `/api/public/health` shows every `cron:*` check ok after an hour
- [ ] `ALERT_WEBHOOK_URL` set; trigger a test (stop the outbox job) and confirm the alert reaches your phone
- [ ] External uptime monitor created for `/api/public/health` with an alert to you

## Supabase
- [ ] Backups: confirm the plan's backup/PITR setting; restore once into a scratch project
- [ ] Auth settings: email confirmation on, leaked-password protection on, redirect URLs list only your domains, unused providers disabled
- [ ] Migrations applied in production match the repository (no pending/missing migrations)
- [ ] Project is not on a plan that pauses when idle (or you accept the risk)

## Accounts and ownership
- [ ] Decide who owns each account in `ENVIRONMENTS.md`. The client owns their Supabase/Lovable/PayFast, or a written transfer plan exists
- [ ] Your personal login is not the only way in (second admin / recovery email documented)
- [ ] Every credential that ever appeared in a chat, document or ticket has been rotated

## Quality
- [ ] CI is green on `main`, including the *migrations* job. Dependency audit reviewed (known zod item in `KNOWN_LIMITS.md`)
- [ ] `ACCEPTANCE_SCRIPT.md` run in staging, all ticked, signed off by the client
- [ ] Page names in `CLIENT_GUIDE.md` checked against the live sidebar and corrected
- [ ] Gemini model id in `src/lib/gemini-live.functions.ts` confirmed against Google's current list
- [ ] Client has read `KNOWN_LIMITS.md`

## Commercial
- [ ] Written support terms: response time, what counts as a bug versus a paid change, price for updates, who is on call and when
- [ ] Client's data-protection obligations (POPIA operator agreement, privacy policy, terms) agreed; `legal.privacy` / `legal.terms` pages reviewed by the client
