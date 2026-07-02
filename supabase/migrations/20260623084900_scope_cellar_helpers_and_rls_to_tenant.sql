-- Tenant-scope Cellar private helpers and RLS policies.
--
-- Cellar tables already carry tenant_id, but many policies used only
-- `cellar_private.current_boh_user_id() is not null` or investor-auth checks.
-- That allowed a staff/investor identity in one tenant to satisfy policies for
-- rows belonging to another tenant. Keep the existing access intent, but bind
-- each policy to the current staff/investor tenant.

create or replace function cellar_private.current_staff_tenant_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select bu.tenant_id
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
    and bu.app_context = 'boh'
    and bu.status = 'active'
  order by bu.created_at asc nulls last
  limit 1
$function$;

create or replace function cellar_private.current_boh_user_id()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare cellar_boh_user_id text;
begin
  if auth.uid() is null or to_regclass('public.boh_user') is null then return null; end if;
  execute 'select id::text from public.boh_user where auth_user_id = $1 and app_context = ''boh'' and status = ''active'' order by created_at asc nulls last limit 1'
    into cellar_boh_user_id using auth.uid();
  return cellar_boh_user_id;
end;
$function$;

create or replace function cellar_private.current_investor_access_tenant_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select cia.tenant_id
  from public.cellar_investor_access as cia
  where cia.auth_user_id = auth.uid()
    and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  order by cia.verified_at desc nulls last, cia.created_at desc
  limit 1
$function$;

create or replace function cellar_private.current_investor_access_status()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select cia.access_status
  from public.cellar_investor_access as cia
  where cia.auth_user_id = auth.uid()
    and cia.tenant_id = cellar_private.current_investor_access_tenant_id()
    and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  order by cia.verified_at desc nulls last, cia.created_at desc
  limit 1
$function$;

create or replace function cellar_private.has_verified_investor_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select cellar_private.current_investor_access_status() is not null
$function$;

create or replace function cellar_private.is_verified_investor(p_investor_access_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.cellar_investor_access as cia
    where cia.id = p_investor_access_id
      and cia.auth_user_id = auth.uid()
      and cia.tenant_id = cellar_private.current_investor_access_tenant_id()
      and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  )
$function$;

create or replace function cellar_private.staff_can_access_investor(p_investor_access_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  cellar_boh_user_id text := cellar_private.current_boh_user_id();
  cellar_staff_tenant_id uuid := cellar_private.current_staff_tenant_id();
begin
  if cellar_boh_user_id is null or cellar_staff_tenant_id is null then return false; end if;
  if exists (
    select 1 from public.cellar_staff_visibility_permissions csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.tenant_id = cellar_staff_tenant_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level = 'hidden'
      and (csvp.expires_at is null or csvp.expires_at > now())
  ) then return false; end if;
  if exists (
    select 1 from public.cellar_investor_access cia
    where cia.id = p_investor_access_id
      and cia.tenant_id = cellar_staff_tenant_id
      and cia.assigned_boh_user_id = cellar_boh_user_id
  ) then return true; end if;
  return exists (
    select 1 from public.cellar_staff_visibility_permissions csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.tenant_id = cellar_staff_tenant_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level in ('viewer', 'responder', 'owner')
      and (csvp.expires_at is null or csvp.expires_at > now())
  );
end;
$function$;

-- Staff/global Cellar policies: bind to current staff tenant.
drop policy if exists cellar_activity_events_staff_insert on public.cellar_activity_events;
create policy cellar_activity_events_staff_insert on public.cellar_activity_events for insert with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
  and actor_kind = 'staff'
  and actor_boh_user_id = cellar_private.current_boh_user_id()
);
drop policy if exists cellar_activity_events_staff_read on public.cellar_activity_events;
create policy cellar_activity_events_staff_read on public.cellar_activity_events for select using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_asset_access_requests_staff_all on public.cellar_asset_access_requests;
create policy cellar_asset_access_requests_staff_all on public.cellar_asset_access_requests for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_assets_staff_all on public.cellar_assets;
create policy cellar_assets_staff_all on public.cellar_assets for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_booking_link_audits_staff_read on public.cellar_booking_link_audits;
create policy cellar_booking_link_audits_staff_read on public.cellar_booking_link_audits for select using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_guest_access_codes_staff_all on public.cellar_guest_access_codes;
create policy cellar_guest_access_codes_staff_all on public.cellar_guest_access_codes for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_investor_access_staff_all on public.cellar_investor_access;
create policy cellar_investor_access_staff_all on public.cellar_investor_access for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_investor_profiles_staff_all on public.cellar_investor_profiles;
create policy cellar_investor_profiles_staff_all on public.cellar_investor_profiles for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_investor_questions_staff_all on public.cellar_investor_questions;
create policy cellar_investor_questions_staff_all on public.cellar_investor_questions for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_investor_sessions_staff_read on public.cellar_investor_sessions;
create policy cellar_investor_sessions_staff_read on public.cellar_investor_sessions for select using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_prepared_qa_staff_all on public.cellar_prepared_qa;
create policy cellar_prepared_qa_staff_all on public.cellar_prepared_qa for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_presentations_staff_all on public.cellar_presentations;
create policy cellar_presentations_staff_all on public.cellar_presentations for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_staff_contact_notes_staff_insert on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_insert on public.cellar_staff_contact_notes for insert with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
  and created_by_boh_user_id = cellar_private.current_boh_user_id()
  and updated_by_boh_user_id = cellar_private.current_boh_user_id()
);
drop policy if exists cellar_staff_contact_notes_staff_read on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_read on public.cellar_staff_contact_notes for select using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);
drop policy if exists cellar_staff_contact_notes_staff_update on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_update on public.cellar_staff_contact_notes for update using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
  and updated_by_boh_user_id = cellar_private.current_boh_user_id()
);

drop policy if exists cellar_staff_visibility_staff_all on public.cellar_staff_visibility_permissions;
create policy cellar_staff_visibility_staff_all on public.cellar_staff_visibility_permissions for all using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
) with check (
  tenant_id = cellar_private.current_staff_tenant_id()
  and cellar_private.current_boh_user_id() is not null
);

drop policy if exists cellar_team_members_staff_read on public.cellar_team_members;
create policy cellar_team_members_staff_read on public.cellar_team_members for select to authenticated using (
  tenant_id = cellar_private.current_staff_tenant_id()
  and exists (
    select 1 from public.boh_user bu
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bu.status = 'active'
      and bu.tenant_id = public.cellar_team_members.tenant_id
  )
);

-- Investor/published policies: bind published-row reads to the verified investor tenant.
drop policy if exists cellar_assets_verified_read_published on public.cellar_assets;
create policy cellar_assets_verified_read_published on public.cellar_assets for select using (
  tenant_id = cellar_private.current_investor_access_tenant_id()
  and status = 'published'
  and investor_kb_scope = 'investor_kb'
  and (
    (visibility = any (array['guest'::text, 'verified'::text]) and cellar_private.has_verified_investor_access())
    or (visibility = 'appendix_granted'::text and cellar_private.current_investor_access_status() = 'appendix_granted'::text)
  )
);

drop policy if exists cellar_prepared_qa_verified_read_published on public.cellar_prepared_qa;
create policy cellar_prepared_qa_verified_read_published on public.cellar_prepared_qa for select using (
  tenant_id = cellar_private.current_investor_access_tenant_id()
  and status = 'published'
  and investor_kb_scope = 'investor_kb'
  and (
    (visibility = any (array['guest'::text, 'verified'::text]) and cellar_private.has_verified_investor_access())
    or (visibility = 'appendix_granted'::text and cellar_private.current_investor_access_status() = 'appendix_granted'::text)
  )
);

drop policy if exists cellar_presentations_verified_read_published on public.cellar_presentations;
create policy cellar_presentations_verified_read_published on public.cellar_presentations for select using (
  tenant_id = cellar_private.current_investor_access_tenant_id()
  and status = 'published'
  and cellar_private.has_verified_investor_access()
);
