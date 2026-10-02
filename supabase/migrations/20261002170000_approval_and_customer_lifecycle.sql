-- Approval workflow + customer lifecycle automation for multi-tenant restaurant operations.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_birthday_reward_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reactivation_sent_at timestamptz;

ALTER TABLE public.outbox_jobs
  DROP CONSTRAINT IF EXISTS outbox_jobs_status_check;
ALTER TABLE public.outbox_jobs
  ADD CONSTRAINT outbox_jobs_status_check CHECK (status IN ('pending','processing','sent','failed','quiet_hours_delayed','approval_required','rejected'));

CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  outbox_job_id uuid NOT NULL UNIQUE REFERENCES public.outbox_jobs(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  message_text text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('yellow','red')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);
CREATE INDEX approval_requests_tenant_status_idx ON public.approval_requests(tenant_id, status, requested_at DESC);

GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Johannesburg';