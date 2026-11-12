BEGIN;
ALTER TABLE public.tenant_profiles ADD COLUMN review_requests_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN review_consent_at timestamptz;
ALTER TABLE public.customers ADD CONSTRAINT customers_tenant_id_id_key UNIQUE(tenant_id,id);
CREATE TABLE public.review_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL,
 customer_id uuid NOT NULL, bill_key text NOT NULL, phone text NOT NULL,
 step text NOT NULL DEFAULT 'check_in' CHECK(step IN ('check_in','review','reminder')),
 state text NOT NULL DEFAULT 'scheduled' CHECK(state IN ('scheduled','processing','accepted','held','cancelled','done')),
 due_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
 review_url text, clicked_at timestamptz, error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,bill_key), FOREIGN KEY(tenant_id,customer_id) REFERENCES public.customers(tenant_id,id)
);
ALTER TABLE public.review_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_followups FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.review_followups TO service_role;
CREATE INDEX review_followups_due ON public.review_followups(state,due_at);
-- The successful, idempotent paid-visit ledger insert is the transaction source of truth.
CREATE FUNCTION public.queue_paid_visit_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.reason='visit_earn' AND coalesce((NEW.metadata->>'spend_cents')::integer,0)>0 AND NEW.idempotency_key LIKE 'visit:%' THEN
  INSERT INTO review_followups(tenant_id,customer_id,bill_key,phone)
  SELECT NEW.tenant_id,c.id,NEW.idempotency_key,regexp_replace(c.phone,'[^0-9]','','g') FROM customers c
  WHERE c.id=NEW.customer_id AND c.tenant_id=NEW.tenant_id AND c.review_consent_at IS NOT NULL AND EXISTS(SELECT 1 FROM tenant_profiles p WHERE p.tenant_id=NEW.tenant_id AND p.review_requests_enabled)
  ON CONFLICT(tenant_id,bill_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_paid_visit_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER paid_visit_review AFTER INSERT ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.queue_paid_visit_review();
CREATE FUNCTION public.claim_review_followup(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE review_followups SET state='processing' WHERE id=p_id AND state='scheduled' AND due_at<=now(); RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_review_followup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_review_followup(uuid) TO service_role;
CREATE FUNCTION public.click_review_link(p_token text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE destination text;
BEGIN
 UPDATE review_followups SET clicked_at=coalesce(clicked_at,now()),state=CASE WHEN step='reminder' AND state='scheduled' THEN 'cancelled' ELSE state END WHERE token=p_token AND review_url IS NOT NULL RETURNING review_url INTO destination;
 RETURN destination;
END $$;
REVOKE ALL ON FUNCTION public.click_review_link(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.click_review_link(text) TO service_role;
-- STOP cancels future work immediately. START does not restart old campaigns.
CREATE FUNCTION public.cancel_review_followups() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE review_followups SET state='cancelled',error='Customer opted out' WHERE tenant_id=NEW.tenant_id AND phone=NEW.phone AND state IN ('scheduled','held','processing');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cancel_review_followups() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stop_review_followups AFTER INSERT ON public.wa_opt_outs FOR EACH ROW EXECUTE FUNCTION public.cancel_review_followups();
-- Retire queued legacy booking-feedback requests, without touching unrelated outbox jobs.
UPDATE public.outbox_jobs SET status='failed',error='Replaced by consented paid-visit review flow' WHERE dedupe_key LIKE 'feedback:%' AND status IN ('pending','quiet_hours_delayed');
COMMIT;
