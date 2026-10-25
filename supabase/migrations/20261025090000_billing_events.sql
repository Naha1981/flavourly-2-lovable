-- Audit + replay protection for PayFast ITN notifications.
-- One row per (pf_payment_id, payment_status); a repeated notification is a no-op.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  pf_payment_id text NOT NULL,
  payment_status text NOT NULL,
  applied_status text NOT NULL,
  subscription_token text,
  amount_gross numeric(12,2),
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_events_unique_payment UNIQUE (pf_payment_id, payment_status)
);
CREATE INDEX IF NOT EXISTS billing_events_tenant_idx ON public.billing_events(tenant_id, received_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.billing_events TO service_role;
