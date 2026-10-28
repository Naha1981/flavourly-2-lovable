-- Template for scheduling Flavourly's five protected jobs with Supabase pg_cron + pg_net.
-- Use ONLY if the jobs are not already scheduled in Lovable Cloud. Run in the Supabase SQL editor.
--
-- 1) Put the SAME value as the app's LOVABLE_CRON_SECRET in Vault (never in the repo or a migration):
--      select vault.create_secret('<LOVABLE_CRON_SECRET value>', 'flavourly_cron_secret');
-- 2) Replace APP_URL below with the deployed https URL (no trailing slash).
-- 3) The endpoints require "Authorization: Bearer <LOVABLE_CRON_SECRET>" (src/integrations/supabase/cron-auth.ts).
--    Test one by hand with curl before enabling the schedule (see RUNBOOK.md).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.flavourly_cron_post(path text) returns void
language plpgsql security definer as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'flavourly_cron_secret';
  perform net.http_post(
    url := 'APP_URL' || path,
    headers := jsonb_build_object('content-type', 'application/json', 'authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end $$;
revoke all on function public.flavourly_cron_post(text) from public, anon, authenticated;

-- Suggested cadence (adjust to your volume; the outbox is the one that must be frequent):
select cron.schedule('flavourly-outbox',             '*/2 * * * *',  $$select public.flavourly_cron_post('/api/public/cron/outbox')$$);
select cron.schedule('flavourly-reminders',          '*/15 * * * *', $$select public.flavourly_cron_post('/api/public/cron/reminders')$$);
select cron.schedule('flavourly-customer-lifecycle', '7 * * * *',    $$select public.flavourly_cron_post('/api/public/cron/customer-lifecycle')$$);
select cron.schedule('flavourly-milestones',         '0 6 * * *',    $$select public.flavourly_cron_post('/api/public/cron/milestones')$$);
select cron.schedule('flavourly-revenue-employee',   '30 5 * * *',   $$select public.flavourly_cron_post('/api/public/cron/revenue-employee')$$);

-- Inspect:  select jobid, jobname, schedule, active from cron.job;
--           select * from cron.job_run_details order by start_time desc limit 20;
-- Remove:   select cron.unschedule('flavourly-outbox');
