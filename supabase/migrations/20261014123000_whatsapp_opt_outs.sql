-- WhatsApp marketing opt-outs (STOP/UNSUBSCRIBE compliance).
-- A guest who replies STOP must not receive automated follow-ups.
-- Manual/transactional replies in an open conversation stay allowed.

CREATE TABLE IF NOT EXISTS public.wa_opt_outs (
  tenant_id text NOT NULL,
  phone text NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'whatsapp_keyword',
  PRIMARY KEY (tenant_id, phone)
);

GRANT ALL ON public.wa_opt_outs TO service_role;
ALTER TABLE public.wa_opt_outs ENABLE ROW LEVEL SECURITY;

-- outbox jobs skipped because the recipient opted out get their own terminal status.
ALTER TABLE public.outbox_jobs
  DROP CONSTRAINT IF EXISTS outbox_jobs_status_check;
ALTER TABLE public.outbox_jobs
  ADD CONSTRAINT outbox_jobs_status_check CHECK (status IN ('pending','processing','sent','failed','quiet_hours_delayed','approval_required','rejected','opted_out'));
