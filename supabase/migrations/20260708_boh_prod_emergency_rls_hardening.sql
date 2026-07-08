-- Emergency production RLS hardening applied manually to BOH prod on 2026-07-08.
-- Project ref: gsidwiptqkyciexqdbyw
-- Purpose: lock down publicly exposed production tables flagged by Supabase
-- Security Advisor: host_application, profile, google_calendar_sync,
-- and google_oauth_tokens.

begin;

alter table public.google_oauth_tokens enable row level security;
alter table public.google_calendar_sync enable row level security;
alter table public.profile enable row level security;
alter table public.host_application enable row level security;

revoke all on table public.google_oauth_tokens from anon, authenticated;
revoke all on table public.google_calendar_sync from anon, authenticated;
revoke all on table public.profile from anon, authenticated;
revoke all on table public.host_application from anon, authenticated;

grant select, update on table public.profile to authenticated;
grant select, insert, update on table public.host_application to authenticated;

drop policy if exists "deny all direct access" on public.google_oauth_tokens;
create policy "deny all direct access" on public.google_oauth_tokens
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny all direct access" on public.google_calendar_sync;
create policy "deny all direct access" on public.google_calendar_sync
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "users_read_own_profile" on public.profile;
create policy "users_read_own_profile" on public.profile
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users_update_own_profile" on public.profile;
create policy "users_update_own_profile" on public.profile
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "host_application_insert_self" on public.host_application;
create policy "host_application_insert_self" on public.host_application
  for insert to authenticated
  with check (applicant_boh_user_id = private.current_boh_user_id());

drop policy if exists "host_application_select_self_or_tenant" on public.host_application;
create policy "host_application_select_self_or_tenant" on public.host_application
  for select to authenticated
  using (
    applicant_boh_user_id = private.current_boh_user_id()
    or reviewed_by_boh_user_id = private.current_boh_user_id()
    or private.current_boh_user_id() is not null
  );

drop policy if exists "host_application_update_reviewer" on public.host_application;
create policy "host_application_update_reviewer" on public.host_application
  for update to authenticated
  using (private.current_boh_user_id() is not null)
  with check (private.current_boh_user_id() is not null);

commit;
