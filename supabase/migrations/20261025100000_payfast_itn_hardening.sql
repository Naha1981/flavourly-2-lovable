-- PayFast ITN deduplication and atomic subscription state transitions.
-- Keep this ledger free of customer PII; pf_payment_id is unique and retained for replay protection.
ALTER TABLE public.tenant_profiles
  ADD COLUMN IF NOT EXISTS payfast_last_event_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payfast_itn_events (
  pf_payment_id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenant_profiles(tenant_id) ON DELETE CASCADE,
  subscription_token text NOT NULL,
  payment_status text NOT NULL CHECK (payment_status IN ('COMPLETE','CANCELLED','FAILED')),
  event_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  outcome text
);

CREATE INDEX IF NOT EXISTS payfast_itn_tenant_event_idx
  ON public.payfast_itn_events(tenant_id, event_at DESC);

ALTER TABLE public.payfast_itn_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payfast_itn_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payfast_itn_events TO service_role;

CREATE OR REPLACE FUNCTION public.apply_payfast_itn(
  p_pf_payment_id text,
  p_tenant_id text,
  p_subscription_token text,
  p_payment_status text,
  p_event_at timestamptz,
  p_tier text,
  p_customer_token text
) RETURNS TABLE(accepted boolean, outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
  t public.tenant_profiles%ROWTYPE;
BEGIN
  IF p_payment_status NOT IN ('COMPLETE','CANCELLED','FAILED') THEN
    RAISE EXCEPTION 'payfast_status_invalid';
  END IF;
  IF p_tier NOT IN ('starter','casual','premium','signature','group') THEN
    RAISE EXCEPTION 'payfast_tier_invalid';
  END IF;
  IF p_pf_payment_id IS NULL OR p_pf_payment_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'payfast_payment_id_invalid';
  END IF;
  IF p_subscription_token IS NULL OR length(p_subscription_token) = 0 THEN
    RAISE EXCEPTION 'payfast_subscription_token_missing';
  END IF;

  INSERT INTO public.payfast_itn_events (
    pf_payment_id, tenant_id, subscription_token, payment_status, event_at
  ) VALUES (
    p_pf_payment_id, p_tenant_id, p_subscription_token, p_payment_status, p_event_at
  ) ON CONFLICT (pf_payment_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted = 0 THEN
    RETURN QUERY SELECT false, 'duplicate'::text;
    RETURN;
  END IF;

  SELECT * INTO t FROM public.tenant_profiles
  WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payfast_tenant_unknown';
  END IF;

  -- Compare reliable payment timestamps when PayFast includes them.
  IF t.payfast_last_event_at IS NOT NULL AND p_event_at < t.payfast_last_event_at THEN
    UPDATE public.payfast_itn_events SET outcome = 'stale_event', applied_at = now()
    WHERE pf_payment_id = p_pf_payment_id;
    RETURN QUERY SELECT false, 'stale_event'::text;
    RETURN;
  END IF;

  -- A late COMPLETE/FAILED from the cancelled subscription must not resurrect it.
  -- Events from a previous subscription are also barred from changing the current plan.
  IF t.payfast_subscription_token IS NOT NULL
    AND p_subscription_token <> t.payfast_subscription_token
    AND p_payment_status IN ('CANCELLED','FAILED') THEN
    UPDATE public.payfast_itn_events SET outcome = 'old_subscription', applied_at = now()
    WHERE pf_payment_id = p_pf_payment_id;
    RETURN QUERY SELECT false, 'old_subscription'::text;
    RETURN;
  END IF;
  IF t.plan_status = 'canceled'
    AND p_subscription_token = t.payfast_subscription_token
    AND p_payment_status <> 'CANCELLED' THEN
    UPDATE public.payfast_itn_events SET outcome = 'cancelled_subscription', applied_at = now()
    WHERE pf_payment_id = p_pf_payment_id;
    RETURN QUERY SELECT false, 'cancelled_subscription'::text;
    RETURN;
  END IF;

  IF p_payment_status = 'COMPLETE' THEN
    UPDATE public.tenant_profiles SET
      plan_tier = p_tier,
      plan_status = 'active',
      payfast_customer_token = COALESCE(p_customer_token, payfast_customer_token),
      payfast_subscription_token = p_subscription_token,
      payfast_last_event_at = p_event_at
    WHERE tenant_id = p_tenant_id;
  ELSIF p_payment_status = 'CANCELLED' THEN
    UPDATE public.tenant_profiles SET
      plan_status = 'canceled',
      payfast_last_event_at = p_event_at
    WHERE tenant_id = p_tenant_id;
  ELSE
    UPDATE public.tenant_profiles SET
      plan_status = 'past_due',
      payfast_last_event_at = p_event_at
    WHERE tenant_id = p_tenant_id;
  END IF;

  UPDATE public.payfast_itn_events SET outcome = lower(p_payment_status), applied_at = now()
  WHERE pf_payment_id = p_pf_payment_id;
  RETURN QUERY SELECT true, lower(p_payment_status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payfast_itn(text,text,text,text,timestamptz,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payfast_itn(text,text,text,text,timestamptz,text,text) TO service_role;
