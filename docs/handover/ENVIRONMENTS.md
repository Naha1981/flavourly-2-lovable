# Environments and service ownership

**Ownership is not verified in the repository.** The account owner for every service must be recorded by the business owner. Do not put passwords, API keys, access tokens, recovery codes, or secret values in this document.

| Service | Purpose | Current evidence / required action | Secret location and rotation |
|---|---|---|---|
| GitHub repository | Source, CI and change history | Repo: [Naha1981/flavourly-2-lovable](https://github.com/Naha1981/flavourly-2-lovable). PR #25 is a draft. Confirm production branch and repository collaborators. | GitHub Actions secrets / repository settings. Rotate exposed credentials at their issuer, not by rewriting history. |
| Lovable | Connected editor/deploy workflow | Repo includes Lovable configuration and instructions. Deployment settings and connected branch are not verified from GitHub. | Lovable Cloud secret/environment settings. Record account owner and recovery path. |
| Hosting / Cloudflare target | Runs TanStack Start/Nitro server routes | Audit describes Cloudflare target; deployed environment and last deployment are not verified. | Host environment secrets. Rotate through host UI, deploy, then validate health. |
| Supabase | Auth, Postgres and service-role access | `src/integrations/supabase/client.server.ts` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; browser client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Production Auth settings and backup/PITR state are unknown. | Service-role key in host secret store only. Rotate in Supabase, update host, deploy, then verify admin queries. Publishable key is not a secret. |
| PayFast | Checkout and subscription ITN | New signature, postback and dedupe code is in the hardening branch. Sandbox transaction lifecycle and live merchant settings remain unverified. | `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX`, `PAYFAST_ALLOWED_IPS` in hosting secret/config. Never put merchant credentials or passphrase in code. |
| NahaLabs WhatsApp operator | WhatsApp account session and messaging API | Code calls central operator; actual URL/health, tenant linking and client phone are not verified. | `OPERATOR_URL`, `OPERATOR_API_KEY`, `WEBHOOK_SECRET` in host secret store. Rotate operator credentials in the operator service and host together. |
| Gemini Live | Voice session tokens / live tools | Code requires `GEMINI_API_KEY`; model ID and deployed access/quota not live-tested here. | Google AI project secret manager / hosting secret settings. Rotate at Google and redeploy. |
| Lovable AI gateway | Reply drafting | Code requires `LOVABLE_API_KEY`; provider access/quota is not verified. | Hosting secret settings. Rotate at issuer and redeploy. |
| Research providers | Revenue Employee external evidence | Optional endpoints and API keys are environment-driven; no production connectivity audit has been completed. | Each provider's own secret store plus app host; rotate both sides. |
| Scheduler / cron | Outbox, reminders, customer lifecycle, milestones, Revenue Employee | Five protected route files exist. The scheduler and last-run telemetry are not verified. | Scheduler uses `LOVABLE_CRON_SECRET`; previous key `LOVABLE_CRON_SECRET_PREVIOUS` supports rotation. Store only in scheduler secret manager and host. |
| Email / alerts | Owner operational alerts | No verified alert transport or successful alert evidence was found during this pass. Record chosen provider and recipient before claiming alerts exist. | Chosen provider's secret store and host. Test and rotate both sides. |

## Environment checklist

For each environment (local, preview/staging, production), record an environment owner, URL, Git commit/deploy ID, database project, operator URL, PayFast mode, secret rotation date, and the person able to recover access. Never store secret values in the table.

Minimum production controls:
- Authentication required (the app now defaults to auth-required; still set `REQUIRE_AUTH=true` explicitly).
- `ALLOW_INSECURE_DEMO=false`.
- Correct production `PUBLIC_APP_URL` using HTTPS.
- Matching live PayFast merchant credentials, passphrase and configured source IPs.
- `LOVABLE_CRON_SECRET` set in host and scheduler, with a tested schedule for each route.
- Supabase email confirmation, leaked-password protection and redirect URLs reviewed.
- Client-owned service accounts or a documented transfer/recovery route.
- Rotate every credential that appeared in a document, chat, issue, action log or commit; audit history with a secret scanner and keep evidence.
