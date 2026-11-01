-- Atomic usage checks for the new inbox transport. No existing rows are rewritten.
-- Usage counts reserved attempts, including failed or ambiguous sends, to fail closed.
BEGIN;
CREATE FUNCTION public.wa_reply_usage(p_tenant text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t tenant_profiles%ROWTYPE; month_start timestamptz; day_start timestamptz;
  monthly_used bigint; daily_used bigint; hourly_used bigint; trial_used bigint;
  monthly_limit integer; why text := NULL;
BEGIN
  SELECT * INTO t FROM tenant_profiles WHERE tenant_id=p_tenant;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'reason','profile_missing'); END IF;
  month_start := date_trunc('month',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg';
  day_start := date_trunc('day',now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg';
  monthly_limit := CASE t.plan_tier WHEN 'starter' THEN 500 WHEN 'casual' THEN 1000 WHEN 'premium' THEN 2500 ELSE 0 END;
  SELECT count(*) FILTER(WHERE used_at>=month_start), count(*) FILTER(WHERE used_at>=day_start),
    count(*) FILTER(WHERE used_at>now()-interval '1 hour'),count(*)
    INTO monthly_used,daily_used,hourly_used,trial_used
    FROM wa_budget_uses WHERE tenant_id=p_tenant AND kind='send';
  IF t.plan_status NOT IN ('active','trialing') THEN why:='subscription_inactive';
  ELSIF t.plan_status='trialing' AND (t.trial_ends_at IS NULL OR t.trial_ends_at<=now()) THEN why:='trial_expired';
  ELSIF monthly_limit=0 THEN why:='plan_not_supported';
  ELSIF monthly_used>=monthly_limit THEN why:='monthly_limit';
  ELSIF t.plan_status='trialing' AND trial_used>=100 THEN why:='trial_limit';
  ELSIF daily_used>=25 THEN why:='pilot_daily_limit';
  ELSIF hourly_used>=60 THEN why:='hourly_limit';
  END IF;
  RETURN jsonb_build_object('allowed',why IS NULL,'reason',why,'plan',t.plan_tier,'status',t.plan_status,
    'monthlyUsed',monthly_used,'monthlyLimit',monthly_limit,'dailyUsed',daily_used,'dailyLimit',25,
    'trialUsed',trial_used,'trialLimit',CASE WHEN t.plan_status='trialing' THEN 100 ELSE NULL END,
    'monthStartsAt',month_start,'dayStartsAt',day_start);
END $$;
REVOKE ALL ON FUNCTION public.wa_reply_usage(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_reply_usage(text) TO service_role;

CREATE OR REPLACE FUNCTION public.wa_reserve_budget(p_tenant text,p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE usage jsonb;
BEGIN
  IF p_kind NOT IN ('send','draft') THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wa-budget:' || p_tenant,0));
  usage := wa_reply_usage(p_tenant);
  IF NOT coalesce((usage->>'allowed')::boolean,false) THEN RETURN false; END IF;
  IF p_kind='draft' AND (SELECT count(*) FROM wa_budget_uses WHERE tenant_id=p_tenant AND kind='draft' AND used_at>now()-interval '24 hours')>=300 THEN RETURN false; END IF;
  INSERT INTO wa_budget_uses(tenant_id,kind) VALUES(p_tenant,p_kind);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.wa_reserve_budget(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wa_reserve_budget(text,text) TO service_role;
COMMIT;
