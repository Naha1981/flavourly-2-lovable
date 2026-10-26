#!/usr/bin/env bash
# Replays every migration, in order, on an EMPTY Postgres and fails if any
# migration errors or if any public table is left without row level security.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/replay-migrations.sh
#
# Supabase-provided pieces (roles, auth schema, auth.uid()) are stubbed so this
# works on a plain Postgres 15+ container. Use a THROWAWAY database.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to an empty scratch Postgres database}"
cd "$(dirname "$0")/.."

psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_run <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL

count=0
for file in supabase/migrations/*.sql; do
  echo "→ $(basename "$file")"
  psql_run --single-transaction -f "$file"
  count=$((count + 1))
done

missing="$(psql "$DATABASE_URL" -At -c "SELECT string_agg(tablename, ', ') FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity")"
if [ -n "$missing" ]; then
  echo "✗ Tables without row level security: $missing" >&2
  exit 1
fi
echo "✓ $count migrations applied cleanly; every public table has RLS enabled."
