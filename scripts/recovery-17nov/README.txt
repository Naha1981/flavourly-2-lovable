17 Nov 2026 free backend recovery
Project: sllsevzvlarcmdyxaibm, NahaLabs FREE, Nano Ireland.
All 38 supabase/migrations/*.sql were applied in filename order inside one transaction to a new empty project. Verified 43 public tables, all with RLS.
Old Lovable database remains paused and untouched. No old users, password hashes, restaurant data or menus were exported. This is a fresh workspace, not data recovery.
Build: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to recovery project; npm run build:pages; node scripts/recovery-17nov/wrap-worker.mjs. Server SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY are secret preview environment bindings. Never put server keys in client bundles.
Exact tested Pages build: https://6d0667ee.flavourly-stranger-preview.pages.dev
Live frontdoor pins that build, retains original /demo guest HTML, and explains fresh-account caveat on home/signup/login. Google login is disabled for this recovery project; email confirmation uses existing Resend SMTP. No WhatsApp/provider credentials were copied. No live sends, payments or booking dispatch were tested.
Rollback: restore rollback-frontdoor.mjs as flavourly-branded-proxy with existing free deployment route. It pins original749512ac preview, retains /demo and removed claim CTA, and does not alter DB or DNS.
Tests:839 unit tests pass, typecheck and build pass; full fresh live signup, branded email confirmation and login/dashboard at https://flavourly.nahalabs.co.za verified. Isolated menu R89 test dish persists on reload. Cross-tenant read403, unauthenticated read401. Phone390px home/dashboard pixels inspected. Synthetic fixtures only.
