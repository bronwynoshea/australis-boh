-- SLOTZ reschedule + reminder workflow migration.
--
-- Dev/prod promotion notes:
-- - The schema changes are idempotent and safe to run in dev first, then prod.
-- - The only environment-specific value is edge_functions_base_url in the cron block.
-- - For prod, change that one value to the prod Supabase functions base URL before running.
-- - Keep the function slugs the same in dev and prod:
--   slotz-reschedule-booking, slotz-cancel-booking, slotz-send-daily-guest-reminders, slotz-send-daily-staff-reminders.

alter table public.scheduling_bookings
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_by text,
  add column if not exists reschedule_reason text,
  add column if not exists previous_start_time timestamptz,
  add column if not exists previous_end_time timestamptz;

create table if not exists public.scheduling_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.scheduling_bookings(id) on delete cascade,
  job_type text not null check (job_type in (
    'booking_confirmed',
    'reminder_24h',
    'reminder_1h',
    'event_rescheduled',
    'event_canceled',
    'no_show_follow_up'
  )),
  recipient_type text not null check (recipient_type in ('guest', 'staff')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'canceled')),
  attempts integer not null default 0,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduling_reminder_jobs_due_idx
  on public.scheduling_reminder_jobs (scheduled_for, status)
  where status = 'pending';

create index if not exists scheduling_reminder_jobs_booking_idx
  on public.scheduling_reminder_jobs (booking_id, job_type, recipient_type);

create table if not exists public.scheduling_email_events (
  id uuid primary key default gen_random_uuid(),
  reminder_job_id uuid references public.scheduling_reminder_jobs(id) on delete set null,
  booking_id uuid references public.scheduling_bookings(id) on delete set null,
  resend_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create or replace function public.enqueue_booking_reminder_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists scheduling_booking_enqueue_reminders on public.scheduling_bookings;
create trigger scheduling_booking_enqueue_reminders
after insert on public.scheduling_bookings
for each row execute function public.enqueue_booking_reminder_jobs();

create or replace function public.enqueue_booking_change_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'confirmed' and new.status = 'cancelled' then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id and status = 'pending';

    insert into public.scheduling_reminder_jobs (booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.id, 'event_canceled', 'guest', now()),
      (new.id, 'event_canceled', 'staff', now());
  elsif new.status = 'confirmed' and (old.start_time <> new.start_time or old.end_time <> new.end_time) then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id and status = 'pending' and job_type in ('reminder_24h', 'reminder_1h');

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
$$;

drop trigger if exists scheduling_booking_enqueue_change_reminders on public.scheduling_bookings;
create trigger scheduling_booking_enqueue_change_reminders
after update on public.scheduling_bookings
for each row execute function public.enqueue_booking_change_jobs();

do $$
declare
  -- DEV default. Change this single value before running in PROD.
  edge_functions_base_url text := 'https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1';
  job record;
begin
  if edge_functions_base_url is null
     or edge_functions_base_url = ''
     or edge_functions_base_url like '%your-project-ref%' then
    raise exception 'Set edge_functions_base_url before scheduling reminder cron jobs.';
  end if;

  for job in
    select jobid
    from cron.job
    where jobname in (
      'send-guest-daily-reminders',
      'send-staff-daily-reminders',
      'slotz-send-daily-guest-reminders',
      'slotz-send-daily-staff-reminders'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'slotz-send-daily-guest-reminders',
    '0 3 * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      edge_functions_base_url || '/slotz-send-daily-guest-reminders'
    )
  );

  perform cron.schedule(
    'slotz-send-daily-staff-reminders',
    '0 3 * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      edge_functions_base_url || '/slotz-send-daily-staff-reminders'
    )
  );
end $$;

select jobname, schedule, active, command
from cron.job
where jobname in ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders')
order by jobname;
