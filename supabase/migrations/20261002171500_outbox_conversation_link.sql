ALTER TABLE public.outbox_jobs
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.wa_conversations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS outbox_jobs_conversation_idx ON public.outbox_jobs(conversation_id) WHERE conversation_id IS NOT NULL;