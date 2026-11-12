-- Tenant-scoped indexes for fleet scale.
-- Every tenant table gets a tenant_id index; the global outbox drain gets one for its
-- status/scheduled_for filter. Idempotent (IF NOT EXISTS) so it is safe to re-run and
-- safe for a fresh 'supabase db reset'. No live database is touched by this file until
-- an approved migration run applies it.

create index if not exists idx_approval_requests_tenant_id on public.approval_requests (tenant_id);
create index if not exists idx_booking_drafts_tenant_id on public.booking_drafts (tenant_id);
create index if not exists idx_campaigns_tenant_id on public.campaigns (tenant_id);
create index if not exists idx_competitor_menu_snapshots_tenant_id on public.competitor_menu_snapshots (tenant_id);
create index if not exists idx_competitor_rating_history_tenant_id on public.competitor_rating_history (tenant_id);
create index if not exists idx_competitors_tenant_id on public.competitors (tenant_id);
create index if not exists idx_customers_tenant_id on public.customers (tenant_id);
create index if not exists idx_feedback_requests_tenant_id on public.feedback_requests (tenant_id);
create index if not exists idx_intelligence_evidence_tenant_id on public.intelligence_evidence (tenant_id);
create index if not exists idx_loyalty_ledger_tenant_id on public.loyalty_ledger (tenant_id);
create index if not exists idx_market_opportunities_tenant_id on public.market_opportunities (tenant_id);
create index if not exists idx_menu_categories_tenant_id on public.menu_categories (tenant_id);
create index if not exists idx_menu_item_pairings_tenant_id on public.menu_item_pairings (tenant_id);
create index if not exists idx_menu_items_tenant_id on public.menu_items (tenant_id);
create index if not exists idx_outbox_jobs_tenant_id on public.outbox_jobs (tenant_id);
create index if not exists idx_payfast_itn_events_tenant_id on public.payfast_itn_events (tenant_id);
create index if not exists idx_reputation_incidents_tenant_id on public.reputation_incidents (tenant_id);
create index if not exists idx_reservations_tenant_id on public.reservations (tenant_id);
create index if not exists idx_revenue_actions_tenant_id on public.revenue_actions (tenant_id);
create index if not exists idx_revenue_agent_runs_tenant_id on public.revenue_agent_runs (tenant_id);
create index if not exists idx_revenue_employee_config_tenant_id on public.revenue_employee_config (tenant_id);
create index if not exists idx_revenue_opportunities_tenant_id on public.revenue_opportunities (tenant_id);
create index if not exists idx_reward_claims_tenant_id on public.reward_claims (tenant_id);
create index if not exists idx_social_content_drafts_tenant_id on public.social_content_drafts (tenant_id);
create index if not exists idx_tenant_members_tenant_id on public.tenant_members (tenant_id);
create index if not exists idx_tenant_profiles_tenant_id on public.tenant_profiles (tenant_id);
create index if not exists idx_wa_conversations_tenant_id on public.wa_conversations (tenant_id);
create index if not exists idx_wa_messages_tenant_id on public.wa_messages (tenant_id);
create index if not exists idx_wa_opt_outs_tenant_id on public.wa_opt_outs (tenant_id);
create index if not exists idx_wa_webhook_events_tenant_id on public.wa_webhook_events (tenant_id);
create index if not exists idx_waitlist_entries_tenant_id on public.waitlist_entries (tenant_id);

-- Global outbox drain: .in(status, ...) + scheduled_for <= now order by scheduled_for.
create index if not exists idx_outbox_jobs_due on public.outbox_jobs (status, scheduled_for);
-- Reservation reminder sweep: status + reservation_date window, attendance null.
create index if not exists idx_reservations_reminder_sweep on public.reservations (status, reservation_date);
