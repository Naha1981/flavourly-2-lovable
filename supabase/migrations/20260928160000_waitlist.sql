-- Guests waiting for a table on a specific date. When a reservation for that
-- date is cancelled, the next waiting guest gets a time-limited offer.
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  requested_date date NOT NULL,
  requested_time time,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','offered','booked','expired','cancelled')),
  offer_reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  offer_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX waitlist_queue_idx ON public.waitlist_entries(tenant_id, requested_date, status, created_at);
CREATE INDEX waitlist_offer_idx ON public.waitlist_entries(status, offer_expires_at) WHERE status = 'offered';

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.waitlist_entries TO service_role;

-- Claims the reservation slot freed by a cancellation for exactly one waiting
-- guest, oldest first, atomically (so two cancellations can't double-offer).
CREATE FUNCTION public.claim_waitlist_offer(
  p_tenant text, p_date date, p_party_size integer, p_reservation_id uuid, p_ttl_minutes integer DEFAULT 20
) RETURNS public.waitlist_entries LANGUAGE plpgsql AS $$
DECLARE w public.waitlist_entries%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.waitlist_entries
  WHERE tenant_id = p_tenant AND requested_date = p_date AND status = 'waiting' AND party_size <= p_party_size
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.waitlist_entries SET
    status = 'offered', offer_reservation_id = p_reservation_id,
    offer_expires_at = now() + (p_ttl_minutes || ' minutes')::interval, updated_at = now()
  WHERE id = w.id
  RETURNING * INTO w;
  RETURN w;
END $$;

REVOKE ALL ON FUNCTION public.claim_waitlist_offer(text, date, integer, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_offer(text, date, integer, uuid, integer) TO service_role;
