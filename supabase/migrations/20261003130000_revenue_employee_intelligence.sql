-- NahaLabs Revenue Employee + evidence/action/outcome fabric.
CREATE TABLE IF NOT EXISTS public.revenue_employee_config (
  tenant_id text PRIMARY KEY REFERENCES public.tenant_profiles(tenant_id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'approval_only'
    CHECK (mode IN ('disabled','shadow','approval_only','active')),
  max_steps integer NOT NULL DEFAULT 12 CHECK (max_steps BETWEEN 1 AND 100),
  max_tool_calls integer NOT NULL DEFAULT 40 CHECK (max_tool_calls BETWEEN 1 AND 200),
  daily_run_limit integer NOT NULL DEFAULT 8 CHECK (daily_run_limit BETWEEN 1 AND 100),
  external_research_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intelligence_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  source_type text NOT NULL,
  provider text NOT NULL,
  evidence_state text NOT NULL DEFAULT 'VERIFIED'
    CHECK (evidence_state IN ('VERIFIED','INFERRED','ESTIMATED','UNKNOWN')),
  title text NOT NULL,
  content text NOT NULL,
  source_url text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  fingerprint text NOT NULL,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS intelligence_evidence_tenant_time_idx
  ON public.intelligence_evidence(tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_evidence_provider_idx
  ON public.intelligence_evidence(tenant_id, provider, created_at DESC);

CREATE TABLE IF NOT EXISTS public.revenue_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  opportunity_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  evidence_summary text,
  estimated_impact_cents bigint,
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  recommended_action text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','approved','executed','dismissed','expired')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  addressed_at timestamptz
);
CREATE INDEX IF NOT EXISTS revenue_opportunities_tenant_status_idx
  ON public.revenue_opportunities(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.revenue_opportunity_evidence (
  opportunity_id uuid NOT NULL REFERENCES public.revenue_opportunities(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.intelligence_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (opportunity_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS public.revenue_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  opportunity_id uuid REFERENCES public.revenue_opportunities(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','rejected','executed','failed')),
  payload jsonb NOT NULL DEFAULT '{}',
  approval_required boolean NOT NULL DEFAULT true,
  approved_by text,
  approved_at timestamptz,
  executed_at timestamptz,
  external_ref text,
  result_summary text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS revenue_actions_tenant_status_idx
  ON public.revenue_actions(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.revenue_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  objective text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  steps integer NOT NULL DEFAULT 0,
  tool_calls integer NOT NULL DEFAULT 0,
  opportunities_found integer NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS revenue_agent_runs_tenant_idx
  ON public.revenue_agent_runs(tenant_id, started_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'revenue_employee_config',
    'intelligence_evidence',
    'revenue_opportunities',
    'revenue_opportunity_evidence',
    'revenue_actions',
    'revenue_agent_runs'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
