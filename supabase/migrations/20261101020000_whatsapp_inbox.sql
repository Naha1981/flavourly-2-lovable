-- Server-only provider bindings. Existing operator IDs are never adopted.
CREATE TABLE public.wa_channels (
  tenant_id text PRIMARY KEY,
  profile_id text NOT NULL UNIQUE,
  account_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_channels ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.wa_channels TO service_role;
ALTER TABLE public.wa_conversations ADD COLUMN provider_conversation_id text;
ALTER TABLE public.wa_conversations ADD COLUMN last_inbound_at timestamptz;
CREATE UNIQUE INDEX wa_provider_conversation_unique ON public.wa_conversations(tenant_id, provider_conversation_id);
CREATE TABLE public.wa_inbox_events (
  event_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_inbox_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.wa_inbox_events TO service_role;
CREATE TABLE public.wa_budget_uses (
  tenant_id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('send','draft')),
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wa_budget_tenant_time ON public.wa_budget_uses(tenant_id, used_at);
ALTER TABLE public.wa_budget_uses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.wa_budget_uses TO service_role;
-- Rolling windows, atomic across workers; failed/ambiguous calls still consume a use.
CREATE FUNCTION public.wa_reserve_budget(p_tenant text, p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_kind NOT IN ('send','draft') THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wa-budget:' || p_tenant, 0));
  IF (SELECT count(*) FROM wa_budget_uses WHERE tenant_id=p_tenant AND kind=p_kind AND used_at>now()-interval '24 hours') >= 300 THEN RETURN false; END IF;
  IF p_kind='send' AND (SELECT count(*) FROM wa_budget_uses WHERE tenant_id=p_tenant AND kind='send' AND used_at>now()-interval '1 hour') >= 60 THEN RETURN false; END IF;
  INSERT INTO wa_budget_uses(tenant_id,kind) VALUES (p_tenant,p_kind);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.wa_reserve_budget(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_reserve_budget(text,text) TO service_role;
-- Capacity must be explicitly configured, never inferred from AI.
ALTER TABLE public.tenant_profiles ADD COLUMN whatsapp_seat_capacity integer CHECK(whatsapp_seat_capacity>0);
CREATE FUNCTION public.wa_confirm_booking(p_tenant text,p_phone text,p_draft uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d booking_drafts%ROWTYPE; seats integer; used integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('wa-booking:' || p_tenant,0));
  SELECT * INTO d FROM booking_drafts WHERE id=p_draft AND tenant_id=p_tenant AND customer_phone=p_phone FOR UPDATE;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF EXISTS(SELECT 1 FROM reservations WHERE source_draft_id=p_draft AND tenant_id=p_tenant) THEN RETURN 'confirmed'; END IF;
  IF d.status<>'awaiting_confirmation' OR d.expires_at<=now() OR d.party_size IS NULL OR d.booking_date IS NULL OR d.booking_time IS NULL OR d.customer_name IS NULL THEN RETURN 'missing'; END IF;
  SELECT whatsapp_seat_capacity INTO seats FROM tenant_profiles WHERE tenant_id=p_tenant;
  IF seats IS NULL THEN RETURN 'needs_manager'; END IF;
  -- Conservative two-hour occupancy either side; no optimistic table splitting.
  SELECT coalesce(sum(party_size),0) INTO used FROM reservations WHERE tenant_id=p_tenant AND status IN ('confirmed','seated') AND abs(extract(epoch FROM ((reservation_date+reservation_time)-(d.booking_date+d.booking_time))))<7200;
  IF used+d.party_size>seats THEN RETURN 'full'; END IF;
  INSERT INTO reservations(tenant_id,customer_phone,customer_name,party_size,reservation_date,reservation_time,customer_confirmed_at,source_draft_id) VALUES(p_tenant,p_phone,d.customer_name,d.party_size,d.booking_date,d.booking_time,now(),d.id);
  UPDATE booking_drafts SET status='confirmed',updated_at=now() WHERE id=d.id AND tenant_id=p_tenant;
  RETURN 'confirmed';
END $$;
REVOKE ALL ON FUNCTION public.wa_confirm_booking(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_confirm_booking(text,text,uuid) TO service_role;
-- Event claim, conversation bump and message insert are one transaction.
CREATE FUNCTION public.wa_ingest_inbox(p_tenant text,p_event text,p_message text,p_conversation text,p_phone text,p_name text,p_body text,p_sent timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE convo uuid; claimed text; detected text := CASE WHEN p_body ~* '(book|table|reserv)' THEN 'booking' WHEN p_body ~* '(complain|refund|sick)' THEN 'complaint' ELSE 'other' END;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('wa-inbox:' || p_tenant,0));
  INSERT INTO wa_inbox_events(event_id,tenant_id) VALUES(p_event,p_tenant) ON CONFLICT DO NOTHING RETURNING event_id INTO claimed;
  IF claimed IS NULL THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM wa_messages WHERE tenant_id=p_tenant AND wa_message_id=p_message) THEN RETURN NULL; END IF;
  INSERT INTO wa_conversations(tenant_id,chat_id,provider_conversation_id,guest_phone,guest_name,last_message,last_message_at,last_inbound_at,unread,intent)
  VALUES(p_tenant,p_conversation,p_conversation,p_phone,p_name,left(p_body,400),p_sent,p_sent,1,detected)
  ON CONFLICT(tenant_id,chat_id) DO UPDATE SET unread=wa_conversations.unread+1,last_inbound_at=greatest(wa_conversations.last_inbound_at,p_sent),last_message=CASE WHEN p_sent>=wa_conversations.last_message_at THEN left(p_body,400) ELSE wa_conversations.last_message END,last_message_at=greatest(wa_conversations.last_message_at,p_sent),provider_conversation_id=p_conversation,status=CASE WHEN wa_conversations.status='resolved' THEN 'open' ELSE wa_conversations.status END
  RETURNING id INTO convo;
  INSERT INTO wa_messages(tenant_id,conversation_id,wa_message_id,direction,body,sent_at) VALUES(p_tenant,convo,p_message,'in',p_body,p_sent);
  RETURN convo;
END $$;
REVOKE ALL ON FUNCTION public.wa_ingest_inbox(text,text,text,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_ingest_inbox(text,text,text,text,text,text,text,timestamptz) TO service_role;
-- Ledger entries may never refer to a customer from another tenant.
CREATE UNIQUE INDEX customers_tenant_id_unique ON public.customers(tenant_id,id);
ALTER TABLE public.loyalty_ledger ADD CONSTRAINT loyalty_customer_tenant_fk FOREIGN KEY(tenant_id,customer_id) REFERENCES public.customers(tenant_id,id);
