-- When a worker claimed an outbox job. Lets processOutbox find jobs abandoned by a
-- crashed or timed-out run (status stuck at 'processing') instead of leaving them forever.
ALTER TABLE public.outbox_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
