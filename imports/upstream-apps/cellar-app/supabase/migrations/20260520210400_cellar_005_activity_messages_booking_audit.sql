-- CELLAR activity stream, scoped messages, and booking-link audit records.
create table if not exists public.cellar_activity_events (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid references public.cellar_investor_access(id) on delete set null,
  investor_session_id uuid references public.cellar_investor_sessions(id) on delete set null,
  actor_kind text not null default 'guest' check (actor_kind in ('guest', 'verified_investor', 'staff', 'system')),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_boh_user_id text,
  event_type text not null,
  event_at timestamptz not null default now(),
  material_id uuid,
  prepared_qa_id uuid,
  slide_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.cellar_activity_events is
  'CELLAR investor/staff/system activity stream for pitch-room events, messages, notes, and booking-link audit events.';
create index if not exists cellar_activity_events_investor_access_id_idx on public.cellar_activity_events (investor_access_id, event_at desc);
create index if not exists cellar_activity_events_session_id_idx on public.cellar_activity_events (investor_session_id, event_at desc);
create index if not exists cellar_activity_events_type_idx on public.cellar_activity_events (event_type, event_at desc);

create table if not exists public.cellar_message_threads (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  subject text not null default 'Investor correspondence',
  status text not null default 'open' check (status in ('open', 'waiting_on_staff', 'waiting_on_investor', 'closed')),
  assigned_boh_user_id text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cellar_message_threads is
  'CELLAR message threads scoped to one selected investor record; not a broad inbox or live chat.';
create index if not exists cellar_message_threads_investor_access_id_idx on public.cellar_message_threads (investor_access_id, last_message_at desc);

drop trigger if exists cellar_message_threads_touch_updated_at on public.cellar_message_threads;
create trigger cellar_message_threads_touch_updated_at before update on public.cellar_message_threads for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.cellar_message_threads(id) on delete cascade,
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  sender_kind text not null check (sender_kind in ('investor', 'staff', 'system')),
  sender_auth_user_id uuid references auth.users(id) on delete set null,
  sender_boh_user_id text,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.cellar_messages is 'CELLAR private investor/staff messages scoped to a selected investor record.';
create index if not exists cellar_messages_thread_sent_idx on public.cellar_messages (thread_id, sent_at);
create index if not exists cellar_messages_investor_sent_idx on public.cellar_messages (investor_access_id, sent_at desc);

create table if not exists public.cellar_booking_link_audits (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid references public.cellar_investor_access(id) on delete set null,
  investor_session_id uuid references public.cellar_investor_sessions(id) on delete set null,
  slotz_booking_id text,
  audit_status text not null default 'link_shown' check (audit_status in ('link_shown', 'clicked', 'started', 'booked', 'cancelled', 'expired')),
  booking_url text,
  requested_at timestamptz not null default now(),
  booked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.cellar_booking_link_audits is 'CELLAR audit trail for showing/clicking Slotz booking links. Slotz remains booking source of truth.';
create index if not exists cellar_booking_link_audits_investor_idx on public.cellar_booking_link_audits (investor_access_id, requested_at desc);
