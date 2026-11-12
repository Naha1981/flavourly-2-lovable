-- Who may act for which restaurant. Enforced server-side by src/lib/tenant-auth.server.ts
-- once REQUIRE_AUTH=true. service_role only for writes; members can read their own rows.
CREATE TABLE public.tenant_members (
  tenant_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX tenant_members_user_idx ON public.tenant_members(user_id);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tenant_members TO service_role;
GRANT SELECT ON public.tenant_members TO authenticated;
CREATE POLICY "members read own rows" ON public.tenant_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
