-- Attendance confirmation from the reminder ladder ("reply YES to confirm").
-- Separate from customer_confirmed_at, which records the original booking confirmation.
ALTER TABLE public.reservations ADD COLUMN attendance_confirmed_at timestamptz;
CREATE INDEX reservations_upcoming_idx ON public.reservations(tenant_id, customer_phone, reservation_date)
  WHERE status = 'confirmed';
