-- Resumability watermarks for fleet-wide cron jobs (customer lifecycle,
-- revenue employee, outbox fairness). Tiny table; service-role only.
create table if not exists public.cron_state (
  job text primary key,
  last_tenant text,
  updated_at timestamptz not null default now()
);

alter table public.cron_state enable row level security;
-- No policies: only the service role (server code) reads or writes watermarks.
