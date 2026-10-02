ALTER TABLE public.tenant_profiles
  ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE public.competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  address text,
  website_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  rating numeric(3,2),
  review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  price_band text CHECK (price_band IN ('$','$$','$$$','$$$$')),
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX competitors_tenant_idx ON public.competitors(tenant_id, is_active);

CREATE TABLE public.competitor_rating_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  competitor_id uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  rating numeric(3,2),
  review_count integer NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competitor_rating_history_idx ON public.competitor_rating_history(tenant_id, competitor_id, captured_at DESC);

CREATE TABLE public.competitor_menu_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  competitor_id uuid NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  source_url text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  content_hash text,
  item_count integer NOT NULL DEFAULT 0,
  menu_items jsonb NOT NULL DEFAULT '[]',
  changes jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX competitor_menu_snapshots_idx ON public.competitor_menu_snapshots(tenant_id, competitor_id, captured_at DESC);

CREATE TABLE public.market_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('price','menu','rating','promotion','demand','coverage','other')),
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  evidence jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','addressed','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  addressed_at timestamptz
);
CREATE INDEX market_opportunities_tenant_idx ON public.market_opportunities(tenant_id, status, created_at DESC);

GRANT ALL ON public.competitors TO service_role;
GRANT ALL ON public.competitor_rating_history TO service_role;
GRANT ALL ON public.competitor_menu_snapshots TO service_role;
GRANT ALL ON public.market_opportunities TO service_role;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_menu_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_opportunities ENABLE ROW LEVEL SECURITY;