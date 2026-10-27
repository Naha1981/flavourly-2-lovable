-- Template for scheduling Flavourly's jobs with Supabase pg_cron + pg_net.
-- Use ONLY if the jobs are not already scheduled in Lovable Cloud. Run in the Supabase SQL editor.
-- Replace APP_URL and put the secret in Vault (never paste the secret into a migration or the repo).
--
--   select vault.create_secret('<same value as LOVABLE_CRON_SECRET>', 'flavourly_cron_secret');
--
-- Authentication: the endpoints require "Authorization: Bearer <LOVABLE_CRON_SECRET>"
-- (src/integrations/supabase/cron-auth.ts). Verify with one manual call before enabling the schedule.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- helper: POST to an endpoint with the secret
create or replace function public.flavourly_cron_post(path text) returns void
language plpgsql security definer as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'flavourly_cron_secret';
  perform net.http_post(
    url := 'APP_URL' || path,                      -- e.g. https://flavourly-2-lovable.lovable.app
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end $$;
revoke all on function public.flavourly_cron_post(text) from public, anon, authenticated;

select cron.schedule('flavourly-outbox',             '*/2 * * * *',  $$select public.flavourly_cron_post('/api/public/cron/outbox')$$);
select cron.schedule('flavourly-reminders',          '*/15 * * * *', $$select public.flavourly_cron_post('/api/public/cron/reminders')$$);
select cron.schedule('flavourly-customer-lifecycle', '7 * * * *',    $$select public.flavourly_cron_post('/api/public/cron/customer-lifecycle')$$);
select cron.schedule('flavourly-milestones',         '0 6 * * *',    $$select public.flavourly_cron_post('/api/public/cron/milestones')$$);
select cron.schedule('flavourly-revenue-employee',   '30 5 * * *',   $$select public.flavourly_cron_post('/api/public/cron/revenue-employee')$$);
select cron.schedule('flavourly-watchdog',           '*/5 * * * *',  $$select public.flavourly_cron_post('/api/public/cron/watchdog')$$);

-- See what is scheduled / recent runs:
--   select jobid, jobname, schedule, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Remove one:  select cron.unschedule('flavourly-outbox');
