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


## Environment and secrets

- Never commit `.env`, `.env.local`, deployment secrets, service-role keys, PayFast credentials/passphrases, operator API keys, webhook secrets, Gemini/AI provider keys, or cron secrets.
- Keep `.env.example` as the single documented list of environment-variable names; include one-line descriptions and required/optional status. Run `bun run check:env` after adding or renaming a variable.
- The Supabase URL and publishable key are public client configuration; never substitute the service-role key in browser variables.
- The repository historically tracked `.env`; `.gitignore` now prevents new environment files from being added, but an ignore rule does not untrack an existing committed file. Verify its current contents and scan the full Git history before deciding whether to untrack it.
- If any secret ever appeared in a commit, document, chat or CI log, rotate it at the issuing provider even if the offending file is later removed. Never rewrite published history.
- Run `bun run check:test-focus` and the typecheck/lint/test/build sequence before pushing.
