BEGIN;
CREATE TABLE public.notification_attempts (
 tenant_id text NOT NULL,user_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('welcome','paid_visit')),
 event_key text NOT NULL,status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','accepted','held')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,user_id,kind,event_key)
);
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.notification_attempts TO service_role;
CREATE FUNCTION public.reserve_notification(p_tenant text,p_user uuid,p_kind text,p_event text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('flavourly-email-global'));
 IF NOT EXISTS(SELECT 1 FROM tenant_members WHERE tenant_id=p_tenant AND user_id=p_user) THEN RETURN false; END IF;
 -- Conservative shared pilot cap, all attempts count. No paid fallback or retry.
 IF (SELECT count(*) FROM notification_attempts WHERE created_at >= date_trunc('day',now())) >= 20 THEN RETURN false; END IF;
 INSERT INTO notification_attempts(tenant_id,user_id,kind,event_key) VALUES(p_tenant,p_user,p_kind,p_event) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.reserve_notification(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_notification(text,uuid,text,text) TO service_role;
COMMIT;
