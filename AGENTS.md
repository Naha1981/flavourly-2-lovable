<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules (read before changing anything)

Full guidance: `docs/handover/CHANGE_GUIDE.md`. The essentials:

- Run before every push: `bun run typecheck && bunx eslint . --rule 'prettier/prettier: off' && bunx vitest run && bun run build`. For migrations also `scripts/replay-migrations.sh` on an empty scratch Postgres.
- Every server function must call `authorizeTenant()` with the correct role; sensitive ones are pinned in `tests/role-matrix.test.ts`. Never trust identity, tenant or WhatsApp account from the browser.
- Send WhatsApp only via `sendWhatsApp()` or the outbox, never the operator directly.
- Do not hand-edit `src/integrations/supabase/*` or `src/routeTree.gen.ts`. Never edit an applied migration; add a new idempotent one with RLS enabled on any new table. Keep the seven no-op duplicate migrations.
- Any new environment variable goes in `.env.example`. Never commit secrets; `.env` holds public browser config only.
- One lockfile (`bun.lock`, public registry only).
- Do not add features while hardening; put ideas in `docs/handover/LATER.md`.
