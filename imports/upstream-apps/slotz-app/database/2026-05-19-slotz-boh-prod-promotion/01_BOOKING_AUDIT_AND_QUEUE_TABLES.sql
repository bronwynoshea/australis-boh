-- SLOTZ reschedule audit fields and reminder queue tables.
-- Safe to run more than once.

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

alter table public.scheduling_reminder_jobs enable row level security;
alter table public.scheduling_email_events enable row level security;
