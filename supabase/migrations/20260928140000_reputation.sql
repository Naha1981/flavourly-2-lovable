-- Post-visit feedback loop: ask for a 1-5 rating, send happy guests to Google,
-- route 1-3 star feedback to a private incident queue for service recovery.
CREATE TABLE public.feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  state text NOT NULL DEFAULT 'asked' CHECK (state IN ('asked','awaiting_comment','done')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  incident_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feedback_requests_lookup_idx ON public.feedback_requests(tenant_id, customer_phone, state, created_at DESC);

CREATE TABLE public.reputation_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 3),
  feedback_text text,
  resolution_status text NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open','investigating','voucher_sent','resolved','ignored')),
  assigned_to text,
  recovery_voucher_code text,
  recovery_voucher_cents integer CHECK (recovery_voucher_cents IS NULL OR recovery_voucher_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX reputation_incidents_tenant_idx ON public.reputation_incidents(tenant_id, resolution_status, created_at DESC);

ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_incidents ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.feedback_requests, public.reputation_incidents TO service_role;
