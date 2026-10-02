ALTER TABLE public.tenant_profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter','casual','premium','signature','group')),
  ADD COLUMN IF NOT EXISTS plan_status text NOT NULL DEFAULT 'trialing' CHECK (plan_status IN ('trialing','active','past_due','canceled')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS payfast_customer_token text,
  ADD COLUMN IF NOT EXISTS payfast_subscription_token text;

CREATE INDEX IF NOT EXISTS tenant_profiles_billing_idx ON public.tenant_profiles(plan_status, plan_tier);