-- Track when a printed/quoted voucher code is actually used at the till.
ALTER TABLE public.reward_claims ADD COLUMN voucher_used_at timestamptz;
ALTER TABLE public.reputation_incidents ADD COLUMN recovery_voucher_used_at timestamptz;
CREATE INDEX reward_claims_voucher_idx ON public.reward_claims(tenant_id, voucher_code) WHERE voucher_code IS NOT NULL;
CREATE INDEX reputation_incidents_voucher_idx ON public.reputation_incidents(tenant_id, recovery_voucher_code) WHERE recovery_voucher_code IS NOT NULL;