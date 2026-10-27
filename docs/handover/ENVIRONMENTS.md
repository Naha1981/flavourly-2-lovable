# Services, accounts and environment variables

## Services

| Service | Used for | Account owner | Notes |
|---|---|---|---|
| Lovable | Hosting/editor; syncs from GitHub `main` | *fill in* | Do not rewrite git history. |
| GitHub | Source, CI | *fill in* | CI: `.github/workflows/flavourly-ci.yml` |
| Supabase | Postgres, auth, backups | *fill in* | Service-role key = full access. RLS is deny-all by design. |
| PayFast | Subscriptions | *fill in* | Sandbox and live are separate merchant accounts. |
| WhatsApp operator (`OPERATOR_URL`) | Sends and receives WhatsApp | *fill in* | Unofficial-API risk: see `KNOWN_LIMITS.md`. |
| Lovable AI gateway (`LOVABLE_API_KEY`) | Message triage, reply drafts, guest preferences | *fill in* | |
| Gemini (`GEMINI_API_KEY`) | Voice operator | *fill in* | Verify the model id in `gemini-live.functions.ts` against Google's current list. |
| Alert channel (`ALERT_WEBHOOK_URL`) | Tells the owner something broke | *fill in* | ntfy.sh topic is free. |
| Uptime monitor | Watches `/api/public/health` | *fill in* | UptimeRobot / BetterStack free tier. |

Write down who owns each account and where the recovery email goes. The owner's personal login must not be the only way in.

## Environment variables

`.env.example` is the authoritative list (a test fails if code reads a variable that is not in it). Required in production:

| Variable | Why |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database access |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser login (public values) |
| `PUBLIC_APP_URL` | `https://` public URL (also switches off the insecure demo bypass) |
| `OPERATOR_URL`, `OPERATOR_API_KEY`, `WEBHOOK_SECRET` | WhatsApp |
| `LOVABLE_CRON_SECRET` | Authenticates the scheduled jobs |
| `LOVABLE_API_KEY` | AI gateway |
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_ALLOWED_IPS` | Billing. `PAYFAST_SANDBOX=false` only for live. The app refuses to run live without a passphrase. |
| `ALERT_WEBHOOK_URL` | Without it, nobody is told when something breaks |

Must NOT be set in production: `ALLOW_INSECURE_DEMO` (it is ignored on https, but keep it empty).

Never commit secrets. `.env` may contain only public browser configuration; a test fails otherwise.
