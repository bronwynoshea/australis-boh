-- Align BOH-dev SLOTZ booking triggers with the imported SLOTZ app.
-- Remove legacy unprefixed/prod-pointing triggers that survived from the old standalone repo.

create extension if not exists pg_net with schema extensions;

drop trigger if exists on_booking_created on public.scheduling_bookings;
drop trigger if exists on_booking_confirmed on public.scheduling_bookings;
drop trigger if exists on_booking_cancelled on public.scheduling_bookings;

drop function if exists public.trigger_create_outlook_event();
drop function if exists public.trigger_send_booking_confirmation();
drop function if exists public.trigger_send_cancellation_notice();

create or replace function public.slotz_send_booking_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_functions_base_url text := 'https://lczzeiqmnegyjrwtgmsj.supabase.co/functions/v1';
  request_id bigint;
begin
  if new.status = 'confirmed' then
    select net.http_post(
      url := edge_functions_base_url || '/slotz-send-booking-confirmation',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('bookingId', new.id)
    )
    into request_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_send_booking_confirmation on public.scheduling_bookings;

create trigger trigger_send_booking_confirmation
after insert on public.scheduling_bookings
for each row
execute function public.slotz_send_booking_confirmation();

revoke all on function public.slotz_send_booking_confirmation() from public;
revoke execute on function public.slotz_send_booking_confirmation() from anon;
revoke execute on function public.slotz_send_booking_confirmation() from authenticated;
