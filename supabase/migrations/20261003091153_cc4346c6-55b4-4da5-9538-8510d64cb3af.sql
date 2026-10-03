-- WhatsApp campaigns with optional A/B variants and real (not illustrative)
-- attribution: bookings and revenue are read back from reservations and the
-- loyalty ledger, matched by phone, in the days after send.
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  segment text NOT NULL CHECK (segment IN ('all','vip','dormant_30','dormant_60')),
  message_a text NOT NULL,
  message_b text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaigns_tenant_idx ON public.campaigns(tenant_id, created_at DESC);

ALTER TABLE public.outbox_jobs ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.outbox_jobs ADD COLUMN variant text CHECK (variant IN ('a','b'));
CREATE INDEX outbox_jobs_campaign_idx ON public.outbox_jobs(campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.campaigns TO service_role;