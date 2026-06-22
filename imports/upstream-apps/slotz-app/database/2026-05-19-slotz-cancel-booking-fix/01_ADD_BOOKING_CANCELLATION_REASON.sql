alter table public.scheduling_bookings
  add column if not exists cancellation_reason text;
