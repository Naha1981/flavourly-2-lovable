BEGIN;
CREATE TABLE public.wa_reply_test_targets(tenant_id text NOT NULL,phone text NOT NULL,PRIMARY KEY(tenant_id,phone));
ALTER TABLE public.wa_reply_test_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_reply_test_targets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_reply_test_targets TO service_role;
-- Durable work is committed with the genuine inbound. Nothing is sent by SQL.
CREATE TABLE public.wa_reply_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL,
 conversation_id uuid NOT NULL, message_id text NOT NULL, account_id text NOT NULL,
 phone text NOT NULL, guest_name text, body text NOT NULL, inbound_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','preparing','sending','accepted','held','finished','superseded')),
 claim_token uuid, claimed_at timestamptz, reply_text text, provider_message_id text,
 error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,message_id), FOREIGN KEY(conversation_id) REFERENCES public.wa_conversations(id)
);
CREATE UNIQUE INDEX wa_reply_one_active_conversation ON public.wa_reply_jobs(tenant_id,conversation_id) WHERE state IN ('preparing','sending');
ALTER TABLE public.wa_reply_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_reply_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_reply_jobs TO service_role;
ALTER TABLE public.wa_inbox_events ADD COLUMN receipt_message text, ADD COLUMN receipt_status text, ADD COLUMN receipt_at timestamptz;
-- Keep the eight-argument ingest unchanged for the old published application.
-- New code alone calls this nine-argument overload, with no default.
CREATE FUNCTION public.wa_ingest_inbox(p_tenant text,p_event text,p_message text,p_conversation text,p_phone text,p_name text,p_body text,p_sent timestamptz,p_standby boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE convo uuid; bound text; keyword text := lower(regexp_replace(trim(p_body),'[.!]+$','','g'));
BEGIN
 SELECT account_id INTO bound FROM wa_channels WHERE tenant_id=p_tenant;
 IF bound IS NULL THEN RAISE EXCEPTION 'Missing bound account'; END IF;
 convo := wa_ingest_inbox(p_tenant,p_event,p_message,p_conversation,p_phone,p_name,p_body,p_sent);
 IF convo IS NULL THEN RETURN NULL; END IF;
 IF keyword IN ('stop','stopall','unsubscribe','opt out','optout','quit') THEN
  INSERT INTO wa_opt_outs(tenant_id,phone) VALUES(p_tenant,p_phone) ON CONFLICT DO NOTHING;
  UPDATE wa_reply_jobs SET state='held',error='Customer opted out',updated_at=now() WHERE tenant_id=p_tenant AND phone=p_phone AND state IN ('queued','preparing');
  UPDATE wa_conversations SET status='resolved' WHERE tenant_id=p_tenant AND id=convo;
 ELSIF keyword IN ('start','unstop','subscribe','resubscribe') THEN
  DELETE FROM wa_opt_outs WHERE tenant_id=p_tenant AND phone=p_phone;
 ELSIF NOT p_standby AND (p_tenant NOT LIKE 'synthetic%' OR (EXISTS(SELECT 1 FROM wa_reply_test_targets x WHERE x.tenant_id=p_tenant AND x.phone=p_phone) AND p_body ~ '^SYNTHETIC QA enquiry( [0-9]+)?:')) AND p_sent>now()-interval '24 hours' AND p_sent<=now()+interval '5 minutes' THEN
  INSERT INTO wa_reply_jobs(tenant_id,conversation_id,message_id,account_id,phone,guest_name,body,inbound_at)
  VALUES(p_tenant,convo,p_message,bound,p_phone,p_name,p_body,p_sent) ON CONFLICT DO NOTHING;
 END IF;
 RETURN convo;
END $$;
REVOKE ALL ON FUNCTION public.wa_ingest_inbox(text,text,text,text,text,text,text,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_inbox(text,text,text,text,text,text,text,timestamptz,boolean) TO service_role;

CREATE FUNCTION public.wa_claim_reply() RETURNS SETOF public.wa_reply_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE chosen uuid;
BEGIN
 -- Serialize claims, not processing. No worker can claim two jobs for one conversation.
 PERFORM pg_advisory_xact_lock(hashtextextended('wa-reply-claim',0));
 WITH expired AS (
 UPDATE wa_reply_jobs SET state='held',error='Interrupted preparation or send; inspect side effects and provider before retry',updated_at=now()
 WHERE state IN ('preparing','sending') AND claimed_at<now()-interval '5 minutes' RETURNING conversation_id,tenant_id
 ) UPDATE wa_conversations c SET status='needs_approval',next_action='Reply result uncertain. Check provider; do not resend.' FROM expired e WHERE c.id=e.conversation_id AND c.tenant_id=e.tenant_id;
 SELECT j.id INTO chosen FROM wa_reply_jobs j WHERE j.state='queued'
 AND NOT EXISTS(SELECT 1 FROM wa_reply_jobs a WHERE a.tenant_id=j.tenant_id AND a.conversation_id=j.conversation_id AND a.state IN ('preparing','sending','held'))
 ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE SKIP LOCKED;
 RETURN QUERY UPDATE wa_reply_jobs SET state='preparing',claim_token=gen_random_uuid(),claimed_at=now(),updated_at=now() WHERE id=chosen RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.wa_claim_reply() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_claim_reply() TO service_role;

CREATE FUNCTION public.wa_begin_reply_send(p_job uuid,p_claim uuid,p_text text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE wa_reply_jobs j SET state='sending',reply_text=p_text,claimed_at=now(),updated_at=now()
 WHERE j.id=p_job AND j.claim_token=p_claim AND j.state='preparing' AND j.inbound_at>now()-interval '24 hours'
 AND EXISTS(SELECT 1 FROM tenant_profiles p WHERE p.tenant_id=j.tenant_id AND p.auto_replies_enabled)
 AND EXISTS(SELECT 1 FROM wa_channels a WHERE a.tenant_id=j.tenant_id AND a.account_id=j.account_id)
 AND NOT EXISTS(SELECT 1 FROM wa_opt_outs o WHERE o.tenant_id=j.tenant_id AND o.phone=j.phone)
 AND EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=j.conversation_id AND c.tenant_id=j.tenant_id AND c.assignee IS NULL AND c.status<>'needs_approval');
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.wa_begin_reply_send(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_begin_reply_send(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.wa_accept_reply(p_job uuid,p_claim uuid,p_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j wa_reply_jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM wa_reply_jobs WHERE id=p_job AND claim_token=p_claim FOR UPDATE;
 IF NOT FOUND OR j.state NOT IN ('sending','accepted') OR nullif(trim(p_provider),'') IS NULL THEN RETURN false; END IF;
 IF j.provider_message_id IS NOT NULL AND j.provider_message_id<>p_provider THEN RETURN false; END IF;
 UPDATE wa_reply_jobs SET state='accepted',provider_message_id=p_provider,updated_at=now() WHERE id=j.id;
 -- Acceptance is committed first; audit is reconciled separately without any network resend.
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.wa_accept_reply(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_accept_reply(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.wa_reconcile_reply(p_job uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j wa_reply_jobs%ROWTYPE; receipt record;
BEGIN
 SELECT * INTO j FROM wa_reply_jobs WHERE id=p_job AND state='accepted' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT receipt_status,receipt_at INTO receipt FROM wa_inbox_events WHERE tenant_id=j.tenant_id AND receipt_message=j.provider_message_id ORDER BY CASE receipt_status WHEN 'read' THEN 4 WHEN 'delivered' THEN 3 WHEN 'sent' THEN 2 ELSE 1 END DESC,receipt_at DESC LIMIT 1;
 INSERT INTO wa_messages(tenant_id,conversation_id,wa_message_id,direction,body,sent_at,delivery_status,delivery_status_at)
 SELECT j.tenant_id,j.conversation_id,j.provider_message_id,'out',j.reply_text,j.updated_at,coalesce(receipt.receipt_status,'accepted'),receipt.receipt_at
 WHERE NOT EXISTS(SELECT 1 FROM wa_messages WHERE tenant_id=j.tenant_id AND wa_message_id=j.provider_message_id);
 UPDATE wa_conversations SET last_message=left(j.reply_text,400),last_message_at=j.updated_at WHERE tenant_id=j.tenant_id AND id=j.conversation_id AND last_message_at<=j.updated_at;
 UPDATE wa_reply_jobs SET state='finished',updated_at=now() WHERE id=j.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.wa_reconcile_reply(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_reconcile_reply(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.wa_record_delivery(p_tenant text,p_event text,p_message text,p_status text,p_at timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed text;
BEGIN
 IF p_status NOT IN ('sent','delivered','read','failed') THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('wa-inbox:' || p_tenant,0));
 INSERT INTO wa_inbox_events(event_id,tenant_id,receipt_message,receipt_status,receipt_at) VALUES(p_event,p_tenant,p_message,p_status,p_at) ON CONFLICT DO NOTHING RETURNING event_id INTO claimed;
 IF claimed IS NULL THEN RETURN false; END IF;
 UPDATE wa_messages SET delivery_status=p_status,delivery_status_at=p_at WHERE tenant_id=p_tenant AND wa_message_id=p_message AND direction='out' AND (delivery_status_at IS NULL OR delivery_status_at<=p_at) AND NOT(delivery_status='read' AND p_status IN ('sent','delivered'));
 RETURN true;
END $$;
-- Extend existing privacy guards only when those optional RPCs are installed.
DO $$ DECLARE f text; definition text; BEGIN
 IF to_regprocedure('public.reject_deleted_workspace_write()') IS NOT NULL THEN
  CREATE TRIGGER reject_deleted_workspace_write BEFORE INSERT OR UPDATE ON public.wa_reply_jobs
   FOR EACH ROW EXECUTE FUNCTION public.reject_deleted_workspace_write();
  CREATE TRIGGER reject_deleted_workspace_write BEFORE INSERT OR UPDATE ON public.wa_reply_test_targets
   FOR EACH ROW EXECUTE FUNCTION public.reject_deleted_workspace_write();
 END IF;
 FOREACH f IN ARRAY ARRAY['privacy_export_workspace','privacy_delete_workspace'] LOOP
  IF to_regprocedure('public.'||f||'(text,uuid)') IS NOT NULL THEN
   definition := pg_get_functiondef(to_regprocedure('public.'||f||'(text,uuid)'));
   IF position('''wa_reply_jobs''' in definition)=0 THEN
    definition := replace(definition,'''wa_messages'',''wa_inbox_events''','''wa_reply_test_targets'',''wa_reply_jobs'',''wa_messages'',''wa_inbox_events''');
    IF f='privacy_delete_workspace' THEN
     definition := replace(definition,'IF EXISTS (SELECT 1 FROM public.outbox_jobs',
      'IF EXISTS (SELECT 1 FROM public.wa_reply_jobs WHERE tenant_id=p_tenant AND state IN (''preparing'',''sending'',''accepted'')) OR EXISTS (SELECT 1 FROM public.outbox_jobs');
    END IF;
    EXECUTE definition;
   END IF;
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
