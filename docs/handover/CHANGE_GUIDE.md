# Safe Change Guide

## Before changing anything

1. Open an issue that names the problem, affected user role, expected behaviour, and acceptance test.
2. Confirm the change does not alter billing amounts, plan tiers, message limits, retention, or customer-visible policy without the owner's written approval.
3. Confirm there is no pending production database migration or deploy.
4. Create a branch from the current main branch. Never amend/rebase/force-push commits already published to the Lovable-connected repository.

## Make one focused change

- One concern per commit, with a message that names its audit finding or user story.
- Add a regression test that fails on the old behaviour.
- Do not hand-edit `src/integrations/supabase/*` generated files or `src/routeTree.gen.ts`.
- If schema changes are needed, add a new migration; do not rewrite an already-applied migration.
- Test migration replay against an empty scratch database, then against a recent non-production restore before production rollout.
- Keep secrets out of source, screenshots, CI logs, issue comments, documentation and commit messages.

## Required checks before proposing a merge

```sh
bun install --frozen-lockfile
bun run check:env
bun run typecheck
npx eslint . --rule 'prettier/prettier: off'
bun run test
bun run build
```

Also verify no focused or skipped tests are introduced and execute the E2E suite after its separate lock/install is reproducible. Review the GitHub Actions run linked to the exact commit, not an earlier run.

## Deploy

1. Ensure the PR is reviewed and all CI checks pass.
2. Confirm the hosting provider's branch/commit and environment settings before deployment.
3. Apply migrations only through the documented Supabase migration process; do not use destructive SQL to make a check pass.
4. Deploy to preview/staging. Run smoke and client acceptance tests with sandbox/test accounts.
5. Inspect server logs for errors and unhandled rejections; ensure no secrets or guest PII appear.
6. Obtain owner/client sign-off before production deploy when the change affects billing, sending, opt-outs, roles, bookings or loyalty.
7. Deploy using the hosting platform's supported workflow and record deployment ID plus commit.

## Rollback

- Application-only regression: use the hosting provider's rollback to a recorded, known-good deployment.
- Database migration: never assume reverting the app undoes the schema. Use a reviewed forward-fix or rehearsed backup restore plan.
- Payment/message side effects: stop the scheduler or relevant integration, reconcile external provider state, then proceed. Never blindly replay outbound sends or ITNs.

## Do not touch without special review

- Published Git history.
- Generated Supabase files or generated route tree.
- Already-applied migrations.
- Billing tiers/prices, plan quotas, retention or opt-out semantics without written approval.
- Production environment keys, merchant settings, or guest records via ad hoc scripts.
- WhatsApp connection state or live number without the restaurant owner's involvement.
