CREATE TABLE public.wa_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  status text NOT NULL DEFAULT 'processed',
  error text,
  raw_body text,
  event_count integer NOT NULL DEFAULT 0,
  saved integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  last_retry_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wa_webhook_events TO service_role;
ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX wa_webhook_events_tenant_idx ON public.wa_webhook_events (tenant_id, received_at DESC);
ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS preferences jsonb;