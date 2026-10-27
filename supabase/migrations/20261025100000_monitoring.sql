-- Self-monitoring: cron heartbeats + alert throttling, and outbox crash recovery.
CREATE TABLE IF NOT EXISTS public.system_heartbeats (
  name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_ok boolean NOT NULL DEFAULT true,
  last_detail text,
  last_alert_at timestamptz
);
ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.system_heartbeats TO service_role;

-- When a worker claims an outbox job. Lets us find jobs abandoned by a crashed/timed-out run.
ALTER TABLE public.outbox_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
