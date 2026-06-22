-- Enqueue reminder jobs when a confirmed booking is created.
-- Safe to run more than once.

create or replace function public.enqueue_booking_reminder_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'confirmed' then
    insert into public.scheduling_reminder_jobs (booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.id, 'booking_confirmed', 'guest', now()),
      (new.id, 'booking_confirmed', 'staff', now()),
      (new.id, 'reminder_24h', 'guest', new.start_time - interval '24 hours'),
      (new.id, 'reminder_24h', 'staff', new.start_time - interval '24 hours'),
      (new.id, 'reminder_1h', 'guest', new.start_time - interval '1 hour'),
      (new.id, 'reminder_1h', 'staff', new.start_time - interval '1 hour');
  end if;

  return new;
end;
$function$;

drop trigger if exists scheduling_booking_enqueue_reminders
  on public.scheduling_bookings;

create trigger scheduling_booking_enqueue_reminders
after insert on public.scheduling_bookings
for each row execute function public.enqueue_booking_reminder_jobs();
