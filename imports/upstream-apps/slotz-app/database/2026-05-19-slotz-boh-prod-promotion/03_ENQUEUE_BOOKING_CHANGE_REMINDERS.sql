-- Enqueue notification/reminder jobs when a booking is canceled or rescheduled.
-- Safe to run more than once.

create or replace function public.enqueue_booking_change_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id and status = 'pending';

    insert into public.scheduling_reminder_jobs (booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.id, 'event_canceled', 'guest', now()),
      (new.id, 'event_canceled', 'staff', now());
  elsif new.status = 'confirmed'
    and (old.start_time <> new.start_time or old.end_time <> new.end_time)
  then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id
        and status = 'pending'
        and job_type in ('reminder_24h', 'reminder_1h');

    insert into public.scheduling_reminder_jobs (booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.id, 'event_rescheduled', 'guest', now()),
      (new.id, 'event_rescheduled', 'staff', now()),
      (new.id, 'reminder_24h', 'guest', new.start_time - interval '24 hours'),
      (new.id, 'reminder_24h', 'staff', new.start_time - interval '24 hours'),
      (new.id, 'reminder_1h', 'guest', new.start_time - interval '1 hour'),
      (new.id, 'reminder_1h', 'staff', new.start_time - interval '1 hour');
  end if;

  return new;
end;
$function$;

drop trigger if exists scheduling_booking_enqueue_change_reminders
  on public.scheduling_bookings;

create trigger scheduling_booking_enqueue_change_reminders
after update on public.scheduling_bookings
for each row execute function public.enqueue_booking_change_jobs();
