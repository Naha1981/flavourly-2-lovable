CREATE TABLE public.support_conversations (
  tenant_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'ai' CHECK (status IN ('ai','waiting_human','resolved')),
  handoff_reason text,
  handed_off_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.support_conversations(tenant_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','assistant','staff','system')),
  body text NOT NULL,
  author_id uuid,
  needs_human boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_tenant_time ON public.support_messages (tenant_id, created_at);
REVOKE ALL ON public.support_conversations, public.support_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.support_conversations, public.support_messages TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;