BEGIN;
ALTER TABLE public.wa_channels ADD COLUMN credential_mode text NOT NULL DEFAULT 'internal' CHECK(credential_mode IN ('internal','customer'));
CREATE TABLE public.wa_tenant_credentials(
 tenant_id text PRIMARY KEY, api_key_ciphertext text NOT NULL,
 webhook_secret_ciphertext text NOT NULL, webhook_id text,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','needs_attention')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_tenant_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_tenant_credentials FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.wa_tenant_credentials TO service_role;
CREATE FUNCTION public.wa_save_customer_connection(p_tenant text,p_profile text,p_key text,p_secret text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('wa-connect:'||p_tenant,0));
 IF EXISTS(SELECT 1 FROM wa_channels WHERE tenant_id=p_tenant) THEN RAISE EXCEPTION 'Existing setup requires team review'; END IF;
 INSERT INTO wa_tenant_credentials(tenant_id,api_key_ciphertext,webhook_secret_ciphertext) VALUES(p_tenant,p_key,p_secret);
 INSERT INTO wa_channels(tenant_id,profile_id,credential_mode) VALUES(p_tenant,p_profile,'customer');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.wa_save_customer_connection(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_save_customer_connection(text,text,text,text) TO service_role;
DO $$ DECLARE f text; definition text; BEGIN
 IF to_regprocedure('public.reject_deleted_workspace_write()') IS NOT NULL THEN
  CREATE TRIGGER reject_deleted_workspace_write BEFORE INSERT OR UPDATE ON public.wa_tenant_credentials
   FOR EACH ROW EXECUTE FUNCTION public.reject_deleted_workspace_write();
 END IF;
 FOREACH f IN ARRAY ARRAY['privacy_export_workspace','privacy_delete_workspace'] LOOP
  IF to_regprocedure('public.'||f||'(text,uuid)') IS NOT NULL THEN
   definition:=pg_get_functiondef(to_regprocedure('public.'||f||'(text,uuid)'));
   IF f='privacy_export_workspace' THEN
    -- Credentials are erased on deletion but must never appear in downloaded exports.
    definition:=replace(definition,'''wa_reply_test_targets''','''wa_tenant_credentials'',''wa_reply_test_targets''');
    definition:=replace(definition,'EXECUTE format(''SELECT coalesce(jsonb_agg', 'IF t.table_name=''wa_tenant_credentials'' THEN CONTINUE; END IF; EXECUTE format(''SELECT coalesce(jsonb_agg');
   ELSE
    definition:=replace(definition,'''wa_reply_test_targets''','''wa_tenant_credentials'',''wa_reply_test_targets''');
   END IF;
   EXECUTE definition;
  END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
