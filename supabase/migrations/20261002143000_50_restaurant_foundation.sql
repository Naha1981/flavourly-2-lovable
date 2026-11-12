-- 50-restaurant foundation: persistent restaurant profile + tenant-scoped Operator credential.
-- The credential is server-only and is never returned to the browser.

ALTER TABLE public.tenant_profiles
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS cuisine text,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS average_check_cents integer CHECK (average_check_cents IS NULL OR average_check_cents >= 0),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS wa_operator_tenant_token text;

CREATE INDEX IF NOT EXISTS tenant_profiles_wa_account_idx
  ON public.tenant_profiles (wa_account_id)
  WHERE wa_account_id IS NOT NULL;

GRANT ALL ON public.tenant_profiles TO service_role;
ALTER TABLE public.tenant_profiles ENABLE ROW LEVEL SECURITY;