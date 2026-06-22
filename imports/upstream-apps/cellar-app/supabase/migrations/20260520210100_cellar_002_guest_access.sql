-- CELLAR guest access-code and visitor session tables. Hashes only; no plaintext codes.
create table if not exists public.cellar_guest_access_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  label text not null default 'Shared investor guest access code',
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  sent_at timestamptz,
  reset_at timestamptz,
  reset_reason text,
  created_by_boh_user_id text,
  reset_by_boh_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cellar_guest_access_codes is
  'CELLAR shared investor guest access codes. Store code_hash only; never store plaintext access codes.';
comment on column public.cellar_guest_access_codes.created_by_boh_user_id is
  'Stores public.boh_user.id resolved from public.boh_user.auth_user_id; add FK after BOH-DEV confirms id type.';

create unique index if not exists cellar_guest_access_codes_one_active_idx
  on public.cellar_guest_access_codes ((status)) where status = 'active';
create index if not exists cellar_guest_access_codes_expires_at_idx
  on public.cellar_guest_access_codes (expires_at);

drop trigger if exists cellar_guest_access_codes_touch_updated_at on public.cellar_guest_access_codes;
create trigger cellar_guest_access_codes_touch_updated_at
  before update on public.cellar_guest_access_codes
  for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_investor_sessions (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid,
  guest_access_code_id uuid references public.cellar_guest_access_codes(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  session_kind text not null default 'guest_code' check (session_kind in ('guest_code', 'verified_auth', 'staff_preview')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.cellar_investor_sessions is
  'CELLAR guest-code and verified investor sessions; guest access does not require investor account creation.';
comment on column public.cellar_investor_sessions.ip_hash is
  'Hash or tokenized IP context only; do not store raw IP without privacy/legal approval.';

create index if not exists cellar_investor_sessions_investor_access_id_idx
  on public.cellar_investor_sessions (investor_access_id);
create index if not exists cellar_investor_sessions_auth_user_id_idx
  on public.cellar_investor_sessions (auth_user_id);
create index if not exists cellar_investor_sessions_last_seen_at_idx
  on public.cellar_investor_sessions (last_seen_at desc);
