# Free-host test build

Build with `npm run build:pages` and deploy `dist` to the separate Cloudflare Pages project `flavourly-stranger-preview`.

The Pages UI has no Lovable publishing badge. Its server-function and `/api/` requests are forwarded only to the existing Flavourly Lovable backend. The database, backend credentials, tenant authentication, WhatsApp provider and scheduled jobs are unchanged. HTML pages and static assets are served by Pages. This is not a migration of the backend or database.

The adapter preserves bearer authorization, rejects foreign-origin server-function calls, removes browser cookies from the upstream request and upstream cookies from responses, and disables caching on backend responses. It cannot accept a user-supplied upstream origin.

The test host is not the production domain. Changing production DNS needs the exact build's GO SURE. Rollback is to keep or restore the current Cloudflare front-door target and existing Lovable publication. No DNS changes are part of this branch.

A hosted UI smoke suite is not proof of WhatsApp delivery or 50-restaurant operating capacity. Those have their own end-to-end acceptance tests.
