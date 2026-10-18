-- Team invites for restaurant workspaces. Idempotent. Rollback: supabase/rollback/20261018190500_team_invites.down.sql
-- Server-side only: the browser never touches this table directly (RLS on, no client policies).
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager','staff')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_invites_tenant_idx ON public.tenant_invites(tenant_id);
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_invites FROM anon, authenticated;
GRANT ALL ON public.tenant_invites TO service_role;
