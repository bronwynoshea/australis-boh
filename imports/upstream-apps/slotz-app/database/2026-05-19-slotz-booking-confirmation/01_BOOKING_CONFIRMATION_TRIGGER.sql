create extension if not exists pg_net with schema extensions;

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
