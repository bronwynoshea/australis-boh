-- Central BOH notification/SMS foundation.
-- BOH owns SMS for cross-app use: marketing, Patron CRM, job seekers,
-- recruiters, and internal users. Apps enqueue events here with source_app
-- and cost_center so spend can be attributed without duplicating providers.

begin;

create table if not exists public.boh_notification_contact_preference (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  patron_person_id uuid references public.patron_person(id) on delete cascade,
  patron_organisation_id uuid references public.patron_organisation(id) on delete set null,
  recipient_type text not null default 'patron'
    check (recipient_type in ('patron', 'job_seeker', 'recruiter', 'internal_user', 'customer', 'lead', 'unknown')),
  email text,
  phone_e164 text,
  sms_consent_status text not null default 'unknown'
    check (sms_consent_status in ('unknown', 'opted_in', 'opted_out')),
  sms_consent_scope text not null default 'transactional'
    check (sms_consent_scope in ('transactional', 'marketing', 'transactional_and_marketing')),
  sms_consent_source text,
  sms_consent_text text,
  sms_consent_at timestamptz,
  sms_opted_out_at timestamptz,
  sms_opt_out_reason text,
  sms_quiet_hours_start time,
  sms_quiet_hours_end time,
  timezone text not null default 'America/New_York',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boh_notification_contact_has_address check (email is not null or phone_e164 is not null),
  constraint boh_notification_contact_sms_consent_check check (
    (sms_consent_status = 'opted_in' and sms_consent_at is not null)
    or sms_consent_status in ('unknown', 'opted_out')
  )
);

create unique index if not exists boh_notification_contact_patron_uidx
  on public.boh_notification_contact_preference(tenant_id, patron_person_id);

create index if not exists boh_notification_contact_phone_idx
  on public.boh_notification_contact_preference(tenant_id, phone_e164)
  where phone_e164 is not null;

create table if not exists public.boh_notification_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  contact_preference_id uuid references public.boh_notification_contact_preference(id) on delete set null,
  patron_person_id uuid references public.patron_person(id) on delete set null,
  patron_organisation_id uuid references public.patron_organisation(id) on delete set null,
  source_app text not null,
  source_record_table text,
  source_record_id text,
  cost_center text not null,
  event_key text not null,
  channel text not null check (channel in ('email', 'sms', 'in_app', 'webhook')),
  provider text not null default 'unassigned',
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'suppressed', 'skipped', 'sending', 'sent', 'delivered', 'failed', 'cancelled')),
  recipient_type text not null default 'patron'
    check (recipient_type in ('patron', 'job_seeker', 'recruiter', 'internal_user', 'customer', 'lead', 'unknown')),
  recipient_email text,
  recipient_phone_e164 text,
  template_key text not null,
  template_version integer not null default 1,
  subject text,
  body_text text not null,
  body_html text,
  idempotency_key text not null,
  consent_checked_at timestamptz,
  consent_status text,
  suppressed_reason text,
  error_message text,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  estimated_cost_minor integer not null default 0,
  actual_cost_minor integer,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boh_notification_event_destination_check check (
    (channel = 'email' and recipient_email is not null)
    or (channel = 'sms' and recipient_phone_e164 is not null)
    or channel in ('in_app', 'webhook')
  )
);

create unique index if not exists boh_notification_event_idempotency_uidx
  on public.boh_notification_event(idempotency_key);

create index if not exists boh_notification_event_queue_idx
  on public.boh_notification_event(status, channel, next_attempt_at nulls first, created_at)
  where status in ('queued', 'failed');

create index if not exists boh_notification_event_cost_idx
  on public.boh_notification_event(tenant_id, source_app, cost_center, created_at desc);

create table if not exists public.boh_sms_inbound_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.boh_tenant(id) on delete set null,
  provider text not null,
  provider_message_id text,
  from_phone_e164 text not null,
  to_phone_e164 text,
  body_text text not null,
  normalized_keyword text,
  action text check (action in ('opt_out', 'opt_in', 'help', 'message', 'unknown')),
  processed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists boh_sms_inbound_phone_idx
  on public.boh_sms_inbound_event(from_phone_e164, created_at desc);

create or replace function public.boh_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_boh_notification_contact_updated_at on public.boh_notification_contact_preference;
create trigger trg_boh_notification_contact_updated_at
  before update on public.boh_notification_contact_preference
  for each row execute function public.boh_touch_updated_at();

drop trigger if exists trg_boh_notification_event_updated_at on public.boh_notification_event;
create trigger trg_boh_notification_event_updated_at
  before update on public.boh_notification_event
  for each row execute function public.boh_touch_updated_at();

alter table public.boh_notification_contact_preference enable row level security;
alter table public.boh_notification_event enable row level security;
alter table public.boh_sms_inbound_event enable row level security;

grant select on public.boh_notification_contact_preference to authenticated;
grant select on public.boh_notification_event to authenticated;
grant select on public.boh_sms_inbound_event to authenticated;

drop policy if exists boh_notification_contact_select_tenant on public.boh_notification_contact_preference;
create policy boh_notification_contact_select_tenant
  on public.boh_notification_contact_preference
  for select
  to authenticated
  using (tenant_id = public.current_boh_tenant_id() or public.is_boh_super_admin());

drop policy if exists boh_notification_event_select_tenant on public.boh_notification_event;
create policy boh_notification_event_select_tenant
  on public.boh_notification_event
  for select
  to authenticated
  using (tenant_id = public.current_boh_tenant_id() or public.is_boh_super_admin());

drop policy if exists boh_sms_inbound_event_select_tenant on public.boh_sms_inbound_event;
create policy boh_sms_inbound_event_select_tenant
  on public.boh_sms_inbound_event
  for select
  to authenticated
  using (tenant_id = public.current_boh_tenant_id() or public.is_boh_super_admin());

comment on table public.boh_notification_contact_preference is
  'Central BOH consent and channel preference record for SMS/email across Patron, marketing, Talent, recruiters, job seekers, and internal users.';

comment on table public.boh_notification_event is
  'Central provider-agnostic notification outbox with source_app and cost_center for cross-app spend attribution.';

comment on table public.boh_sms_inbound_event is
  'Central inbound SMS webhook audit log for STOP/START/HELP and replies.';

commit;
