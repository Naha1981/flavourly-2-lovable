-- Flavourly Revenue Intelligence OS: venue profile, menu + 86 toggle, pairings,
-- booking drafts, loyalty ledger, GPS claims, outbox, social drafts.
-- Same conventions as the existing wa_* tables: tenant_id text, RLS on,
-- server-side access via service_role only.

CREATE TABLE public.tenant_profiles (
  tenant_id text PRIMARY KEY,
  name text NOT NULL,
  whatsapp_phone text,
  wa_account_id text,
  manager_phone text,
  google_review_url text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  geofence_radius_m integer NOT NULL DEFAULT 500 CHECK (geofence_radius_m BETWEEN 50 AND 5000),
  auto_replies_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_categories_tenant_idx ON public.menu_categories(tenant_id, sort_order);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  cost_price_cents integer CHECK (cost_price_cents >= 0),
  is_available boolean NOT NULL DEFAULT true, -- the "86" toggle
  dietary_flags text[] NOT NULL DEFAULT '{}',
  image_url text,
  sales_count_30d integer NOT NULL DEFAULT 0 CHECK (sales_count_30d >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_items_tenant_idx ON public.menu_items(tenant_id, is_available);

CREATE TABLE public.menu_item_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  source_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  paired_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  pairing_type text NOT NULL DEFAULT 'cross_sell'
    CHECK (pairing_type IN ('upsell','cross_sell','beverage_pairing','dessert_pairing')),
  pitch_copy text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_item_id <> paired_item_id),
  UNIQUE (source_item_id, paired_item_id)
);
CREATE INDEX menu_item_pairings_source_idx ON public.menu_item_pairings(tenant_id, source_item_id);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  phone text NOT NULL,
  name text,
  birthday text CHECK (birthday IS NULL OR birthday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  total_spend_cents bigint NOT NULL DEFAULT 0,
  visit_count integer NOT NULL DEFAULT 0,
  is_vip boolean NOT NULL DEFAULT false,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  points_change integer NOT NULL,
  reason text NOT NULL CHECK (reason IN
    ('welcome_bonus','visit_earn','bill_redemption','birthday_gift','vip_reward','staff_adjustment')),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX loyalty_ledger_customer_idx ON public.loyalty_ledger(tenant_id, customer_id);

CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  points_to_burn integer NOT NULL CHECK (points_to_burn > 0 AND points_to_burn % 100 = 0),
  discount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending_gps'
    CHECK (status IN ('pending_gps','redeemed','expired','out_of_bounds')),
  voucher_code text,
  client_lat numeric(10,7),
  client_lon numeric(10,7),
  distance_meters integer,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_phone text NOT NULL,
  customer_name text,
  party_size integer CHECK (party_size BETWEEN 1 AND 50),
  booking_date date,
  booking_time time,
  special_requests text,
  status text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting','awaiting_confirmation','confirmed','expired','abandoned')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_drafts_lookup_idx ON public.booking_drafts(tenant_id, customer_phone, status, expires_at);

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_phone text NOT NULL,
  customer_name text NOT NULL,
  party_size integer NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  special_requests text,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','seated','completed','cancelled','no_show')),
  customer_confirmed_at timestamptz,
  source_draft_id uuid UNIQUE REFERENCES public.booking_drafts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_tenant_date_idx ON public.reservations(tenant_id, reservation_date);

CREATE TABLE public.outbox_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  recipient_phone text NOT NULL,
  message_text text NOT NULL,
  automated boolean NOT NULL DEFAULT true,
  dedupe_key text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','quiet_hours_delayed')),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key)
);
CREATE INDEX outbox_jobs_due_idx ON public.outbox_jobs(status, scheduled_for);

CREATE TABLE public.social_content_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  caption text NOT NULL,
  media_urls jsonb NOT NULL DEFAULT '[]',
  target_platforms jsonb NOT NULL DEFAULT '["instagram","facebook"]',
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('drafted','pending_approval','approved','published','rejected')),
  scheduled_for timestamptz,
  approved_by text,
  approved_at timestamptz,
  openpost_post_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_drafts_tenant_idx ON public.social_content_drafts(tenant_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Atomic ledger helpers (all money/points maths stays in the database).
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.loyalty_balance(p_tenant text, p_customer uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(points_change), 0)::int
  FROM public.loyalty_ledger WHERE tenant_id = p_tenant AND customer_id = p_customer;
$$;

-- Returns true only when the row was newly inserted (idempotent per key).
CREATE FUNCTION public.award_points(
  p_tenant text, p_customer uuid, p_points integer, p_reason text, p_key text, p_meta jsonb DEFAULT '{}'
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO public.loyalty_ledger(tenant_id, customer_id, points_change, reason, idempotency_key, metadata)
  VALUES (p_tenant, p_customer, p_points, p_reason, p_key, p_meta)
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted = 1;
END $$;

-- R1 = 1 point. Idempotent per bill reference; VIP at 5+ visits or R5,000+ spend.
CREATE FUNCTION public.record_visit(
  p_tenant text, p_customer uuid, p_spend_cents integer, p_bill_ref text
) RETURNS TABLE(points_earned integer, visit_count integer, is_vip boolean, already_recorded boolean)
LANGUAGE plpgsql AS $$
DECLARE pts integer := floor(p_spend_cents / 100.0)::int; fresh boolean;
BEGIN
  IF p_spend_cents < 0 THEN RAISE EXCEPTION 'spend must be >= 0'; END IF;
  fresh := public.award_points(p_tenant, p_customer, pts, 'visit_earn', 'visit:' || p_bill_ref,
                               jsonb_build_object('spend_cents', p_spend_cents, 'bill_ref', p_bill_ref));
  IF fresh THEN
    UPDATE public.customers c SET
      total_spend_cents = c.total_spend_cents + p_spend_cents,
      visit_count = c.visit_count + 1,
      last_visit_at = now(),
      is_vip = c.is_vip OR (c.visit_count + 1 >= 5) OR (c.total_spend_cents + p_spend_cents >= 500000)
    WHERE c.id = p_customer AND c.tenant_id = p_tenant;
  END IF;
  RETURN QUERY SELECT CASE WHEN fresh THEN pts ELSE 0 END, c.visit_count, c.is_vip, NOT fresh
    FROM public.customers c WHERE c.id = p_customer AND c.tenant_id = p_tenant;
END $$;

-- Burn points and issue the voucher in one transaction, guarding against
-- double-redeem, expiry and overdraw. Raises on any failure.
CREATE FUNCTION public.redeem_claim(
  p_token text, p_voucher text, p_lat numeric, p_lon numeric, p_distance integer
) RETURNS TABLE(voucher_code text, discount_cents integer)
LANGUAGE plpgsql AS $$
DECLARE c public.reward_claims%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.reward_claims WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR c.status <> 'pending_gps' OR c.expires_at <= now() THEN
    RAISE EXCEPTION 'claim_invalid';
  END IF;
  IF public.loyalty_balance(c.tenant_id, c.customer_id) < c.points_to_burn THEN
    RAISE EXCEPTION 'insufficient_points';
  END IF;
  INSERT INTO public.loyalty_ledger(tenant_id, customer_id, points_change, reason, idempotency_key, metadata)
  VALUES (c.tenant_id, c.customer_id, -c.points_to_burn, 'bill_redemption', 'burn_claim:' || c.id,
          jsonb_build_object('voucher_code', p_voucher, 'claim_id', c.id));
  UPDATE public.reward_claims SET status = 'redeemed', voucher_code = p_voucher,
    client_lat = p_lat, client_lon = p_lon, distance_meters = p_distance, redeemed_at = now()
  WHERE id = c.id;
  RETURN QUERY SELECT p_voucher, c.discount_cents;
END $$;

-- ---------------------------------------------------------------------------
-- Access: server-side only (service_role). RLS on, no anon/authenticated policies.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_profiles','menu_categories','menu_items','menu_item_pairings',
    'customers','loyalty_ledger','reward_claims','booking_drafts','reservations','outbox_jobs',
    'social_content_drafts'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.loyalty_balance(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_points(text, uuid, integer, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_visit(text, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_claim(text, text, numeric, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_balance(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_points(text, uuid, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_visit(text, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_claim(text, text, numeric, numeric, integer) TO service_role;
