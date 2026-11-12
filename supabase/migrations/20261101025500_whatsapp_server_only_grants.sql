-- Default project grants must not expose these internal WhatsApp tables.
-- Keep row security, existing policies, functions and all data unchanged.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
  public.wa_channels,
  public.wa_inbox_events,
  public.wa_budget_uses
FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE
  public.wa_channels,
  public.wa_inbox_events,
  public.wa_budget_uses
TO service_role;
COMMIT;
