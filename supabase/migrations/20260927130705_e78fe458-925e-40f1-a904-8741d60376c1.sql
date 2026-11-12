CREATE TABLE public.wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  chat_id text NOT NULL,
  guest_name text,
  guest_phone text,
  status text NOT NULL DEFAULT 'open',
  urgency text NOT NULL DEFAULT 'medium',
  intent text NOT NULL DEFAULT 'other',
  sentiment text,
  summary text,
  next_action text,
  assignee text,
  unread integer NOT NULL DEFAULT 0,
  last_message text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, chat_id)
);
GRANT ALL ON public.wa_conversations TO service_role;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  wa_message_id text UNIQUE,
  direction text NOT NULL DEFAULT 'in',
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX wa_messages_conv_idx ON public.wa_messages(conversation_id, sent_at);
CREATE INDEX wa_conversations_tenant_idx ON public.wa_conversations(tenant_id, last_message_at DESC);