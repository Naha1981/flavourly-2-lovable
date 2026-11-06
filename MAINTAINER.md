# Maintainer notes

Technical reference only, not customer-facing wording. Reviewed 6 November 2026. These commands are defined in the source, not newly executed in this documentation pass. Use the repository lockfile and established CI/runtime versions. No release or production migration is authorised by this file.

## Defined commands

```sh
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
```

## Development

Use Node.js 22 and Bun so local installs match CI. Install Bun from https://bun.sh/docs/installation.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install --frozen-lockfile
bun run dev
```

CI runs typecheck, ESLint, Vitest, and the production Vite build in that order. The separate `e2e/` package has not yet been added to the frozen root install; see the handover checklist for the remaining e2e reproducibility gate.


## Authentication safety

Server functions require a valid Supabase user session and tenant membership by default in development, preview, and production. Set `REQUIRE_AUTH=true` in deployed environments. The legacy `NODE_ENV` value is not an authentication control.

`ALLOW_INSECURE_DEMO=true` is an explicit local-test-only escape hatch and is ignored when `PUBLIC_APP_URL` is missing, invalid, or HTTPS. Never enable it for a client or internet-facing deployment. Do not put service-role keys or other secrets in `.env.example`; use your hosting provider's secret settings.


## Client handover documentation

See [docs/handover/README.md](docs/handover/README.md) for the architecture and verification status, [RUNBOOK.md](docs/handover/RUNBOOK.md) for incident triage, and [CLIENT_GUIDE.md](docs/handover/CLIENT_GUIDE.md) for restaurant-manager workflows. This documentation is not evidence that live environment settings, schedules, alerts, payments, or client acceptance have been verified.

## Configuration and costs

Use current example environment schemas and source reads to determine required configuration. Examples contain placeholders only. Do not print credentials or replace licence/attribution files. Do not activate messages, payments, migrations or publication without the applicable approval. No unlimited free service or permanent quota is promised.
