-- Minimal non-customer-data tombstone prevents stale jobs recreating deleted workspaces.
CREATE TABLE public.deleted_workspace_ids (workspace_id text PRIMARY KEY, deleted_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.deleted_workspace_ids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deleted_workspace_ids FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.deleted_workspace_ids TO service_role;
CREATE FUNCTION public.reject_deleted_workspace_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.deleted_workspace_ids WHERE workspace_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'Workspace was permanently deleted';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.reject_deleted_workspace_write() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY table_name
  LOOP
    EXECUTE format('CREATE TRIGGER reject_deleted_workspace_write BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_deleted_workspace_write()',t.table_name);
  END LOOP;
END; $$;

-- Owner-only privacy functions. Invoked only by authenticated server handlers.
-- No live deletion or migration execution is authorized by this source file.
CREATE OR REPLACE FUNCTION public.privacy_export_workspace(p_tenant text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '3s' AS $$
DECLARE t record; rows jsonb; result jsonb := '{}'::jsonb;
  deletion_order text[] := ARRAY[
    'notification_attempts','review_followups','feedback_requests','reputation_incidents','approval_requests',
    'wa_messages','wa_inbox_events','wa_webhook_events','wa_budget_uses','wa_opt_outs','wa_channels',
    'outbox_jobs','waitlist_entries','reservations','booking_drafts','reward_claims','loyalty_ledger',
    'customers','menu_item_pairings','menu_items','menu_categories','social_content_drafts','campaigns',
    'competitor_rating_history','competitor_menu_snapshots','competitors','market_opportunities',
    'revenue_actions','revenue_opportunities','intelligence_evidence','revenue_agent_runs',
    'revenue_employee_config','ai_usage_counters','payfast_itn_events','wa_conversations','tenant_members','tenant_profiles'
  ];

BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=p_tenant AND user_id=p_actor AND role='owner') THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  -- Fail closed on schema drift. A reviewer must add every new tenant-bearing table.
  FOR t IN SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='tenant_id'
  LOOP
    IF NOT t.table_name = ANY(deletion_order) THEN RAISE EXCEPTION 'Unreviewed tenant table: %',t.table_name; END IF;
  END LOOP;
  -- Each section is a tenant-only set; lock tenant tables for a consistent export.
  FOR t IN SELECT DISTINCT c.table_name FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.column_name='tenant_id' ORDER BY c.table_name
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE MODE', t.table_name);
  END LOOP;
  FOR t IN SELECT DISTINCT c.table_name FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.column_name='tenant_id' ORDER BY c.table_name
  LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE tenant_id=$1', t.table_name)
      INTO rows USING p_tenant;
    result := result || jsonb_build_object(t.table_name, rows);
    IF octet_length(result::text) > 10000000 THEN RAISE EXCEPTION 'Export exceeds safe download size; assisted export required'; END IF;
  END LOOP;
  IF to_regclass('public.revenue_opportunity_evidence') IS NOT NULL THEN
    LOCK TABLE public.revenue_opportunity_evidence IN SHARE MODE;
    SELECT coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) INTO rows
      FROM public.revenue_opportunity_evidence e JOIN public.revenue_opportunities o ON o.id=e.opportunity_id
      WHERE o.tenant_id=p_tenant;
    result := result || jsonb_build_object('revenue_opportunity_evidence',rows);
  END IF;
  IF octet_length(result::text) > 10000000 THEN RAISE EXCEPTION 'Export exceeds safe download size'; END IF;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.privacy_delete_workspace(p_tenant text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '3s' AS $$
DECLARE t text; r record;
  deletion_order text[] := ARRAY[
    'notification_attempts','review_followups','feedback_requests','reputation_incidents','approval_requests',
    'wa_messages','wa_inbox_events','wa_webhook_events','wa_budget_uses','wa_opt_outs','wa_channels',
    'outbox_jobs','waitlist_entries','reservations','booking_drafts','reward_claims','loyalty_ledger',
    'customers','menu_item_pairings','menu_items','menu_categories','social_content_drafts','campaigns',
    'competitor_rating_history','competitor_menu_snapshots','competitors','market_opportunities',
    'revenue_actions','revenue_opportunities','intelligence_evidence','revenue_agent_runs',
    'revenue_employee_config','ai_usage_counters','payfast_itn_events','wa_conversations','tenant_members','tenant_profiles'
  ];
BEGIN
  -- Fail closed on schema drift. A reviewer must add every new tenant-bearing table.
  FOR r IN SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='tenant_id'
  LOOP
    IF NOT r.table_name = ANY(deletion_order) THEN RAISE EXCEPTION 'Unreviewed tenant table: %',r.table_name; END IF;
  END LOOP;
  -- Prevent concurrent inserts/updates during the deletion transaction. Locks are
  -- held only until commit; a failure rolls back every deletion.
  FOR t IN SELECT unnest(deletion_order) ORDER BY 1 LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t); END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE tenant_id=p_tenant AND user_id=p_actor AND role='owner') THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenant_profiles WHERE tenant_id=p_tenant
    AND (coalesce(plan_status,'')='active' OR coalesce(payfast_subscription_token,'')<>'')) THEN
    RAISE EXCEPTION 'Cancel and verify external subscription before deletion';
  END IF;
  IF EXISTS (SELECT 1 FROM public.outbox_jobs WHERE tenant_id=p_tenant AND status='processing')
    OR EXISTS (SELECT 1 FROM public.review_followups WHERE tenant_id=p_tenant AND state='processing')
    OR EXISTS (SELECT 1 FROM public.notification_attempts WHERE tenant_id=p_tenant AND status='processing') THEN
    RAISE EXCEPTION 'In-flight work must finish or be reconciled before deletion';
  END IF;
  INSERT INTO public.deleted_workspace_ids(workspace_id) VALUES(p_tenant);
  FOR t IN SELECT unnest(deletion_order) LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN EXECUTE format('DELETE FROM public.%I WHERE tenant_id=$1',t) USING p_tenant; END IF;
  END LOOP;
  RETURN jsonb_build_object('deleted',true,'tenantId',p_tenant);
END; $$;
REVOKE ALL ON FUNCTION public.privacy_export_workspace(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.privacy_delete_workspace(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_export_workspace(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.privacy_delete_workspace(text,uuid) TO service_role;
