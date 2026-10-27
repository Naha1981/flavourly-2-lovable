# Flavourly: handover overview

Flavourly is a WhatsApp-first guest-retention app for restaurants: inbox and AI replies, bookings and reminders, loyalty and vouchers, campaigns, reputation recovery, a revenue "employee" agent, and PayFast billing. It is multi-tenant: one deployment, many restaurants, each identified by a slug (`tenantId`).

## How it fits together

```
Guest ── WhatsApp ──▶ WhatsApp operator (Baileys) ──signed webhook──▶ /api/public/webhooks/whatsapp
                              ▲                                              │
                              │ send                                          ▼
Restaurant staff ──▶ Dashboard (TanStack Start, server functions) ──▶ Supabase (Postgres, RLS deny-all)
                              │                                              ▲
PayFast ──ITN──▶ /api/public/billing/webhook                                 │
Scheduler ──POST + secret──▶ /api/public/cron/*  (outbox, reminders, ...) ───┘
Uptime monitor ──GET──▶ /api/public/health          Watchdog ──▶ ALERT_WEBHOOK_URL (your phone)
```

Key facts for anyone changing it:

- **All data access goes through server functions using the Supabase service role.** Row level security is enabled on every table with no policies (deny-all to browsers), so the only tenant wall is `authorizeTenant()` in `src/lib/tenant-auth.server.ts`. Every server function must call it. `src/lib/tenant-guard.test.ts` and `tests/role-matrix.test.ts` enforce this.
- **Auth is fail-closed.** Login is required unless `ALLOW_INSECURE_DEMO=true` on a non-https, non-production deployment.
- **Every outbound WhatsApp message** goes through `sendWhatsApp()` (billing and quota gate). Automated messages go through the outbox (opt-out, quiet hours, retries).
- **Scheduled jobs** are plain HTTP endpoints; nothing in the repo schedules them. See `RUNBOOK.md`.

## Run locally

```sh
bun install --frozen-lockfile
cp .env.example .env.local      # fill in what you need; leave ALLOW_INSECURE_DEMO=true for local-only login bypass
bun run dev
```

## The checks (all must pass before merging; CI runs them)

```sh
bun run typecheck && bunx eslint . --rule 'prettier/prettier: off' && bunx vitest run && bun run build
DATABASE_URL=postgres://... scripts/replay-migrations.sh   # on an EMPTY scratch Postgres
```

## Other documents in this folder

| File | For |
|---|---|
| `RUNBOOK.md` | What each alert means and how to fix it; cron schedule; rotating secrets |
| `ENVIRONMENTS.md` | Every service and environment variable, who owns it |
| `ROLES.md` | Who can do what (owner / manager / staff) |
| `CLIENT_GUIDE.md` | Plain-language guide for restaurant managers |
| `CHANGE_GUIDE.md` | How to change the app safely, and what not to touch |
| `KNOWN_LIMITS.md` | What the app does not do or does imperfectly, in plain terms |
| `ACCEPTANCE_SCRIPT.md` | Click-through test to run before go-live and after big changes |
| `OWNER_CHECKLIST.md` | Things only a human with dashboard access can verify |
| `LATER.md` | Deferred ideas and technical debt |
| `cron.sql` | pg_cron + pg_net template for scheduling the jobs |
