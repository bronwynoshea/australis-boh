create table if not exists public.google_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.scheduling_staff_profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  account_id text not null,
  account_username text not null,
  account_name text,
  token_type text default 'Bearer',
  scope text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_oauth_tokens_staff_active_idx
  on public.google_oauth_tokens(staff_id)
  where is_active = true;

create table if not exists public.google_calendar_sync (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references public.scheduling_staff_profiles(id) on delete cascade,
  is_enabled boolean not null default false,
  sync_interval_minutes integer not null default 1440,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  sync_calendar_id text default 'primary',
  sync_calendar_name text,
  timezone text,
  buffer_minutes_before integer not null default 0,
  buffer_minutes_after integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
