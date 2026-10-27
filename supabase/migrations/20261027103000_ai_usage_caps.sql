-- Per-tenant daily AI usage counters (Definition of Done, Gate D cost
-- safety). One bug or abusive tenant must not be able to generate a surprise
-- LLM bill for the fleet. Service-role only; RLS enabled with no policies.

create table if not exists public.ai_usage_counters (
  tenant_id text not null,
  day date not null,
  calls integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, day)
);

alter table public.ai_usage_counters enable row level security;
-- No policies: only the service role (server code) reads or writes counters.

-- Atomic increment-and-read so concurrent calls cannot both pass the cap.
create or replace function public.bump_ai_usage(p_tenant_id text, p_day date)
returns integer
language sql
as $$
  insert into public.ai_usage_counters (tenant_id, day, calls)
  values (p_tenant_id, p_day, 1)
  on conflict (tenant_id, day)
  do update set calls = ai_usage_counters.calls + 1, updated_at = now()
  returning calls;
$$;
