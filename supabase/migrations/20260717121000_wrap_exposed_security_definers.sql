-- Remove directly executable SECURITY DEFINER functions from the exposed API
-- while preserving app contracts through narrow SECURITY INVOKER wrappers.
begin;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.current_boh_tenant_id_advisor_impl()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bu.tenant_id
  from public.boh_user bu
  where bu.auth_user_id = (select auth.uid())
    and bu.app_context = 'boh'
  order by bu.created_at asc nulls last
  limit 1
$$;

create or replace function private.is_boh_staff_advisor_impl()
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.boh_user bu
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bu.status = 'active'
      and bu.tenant_id = private.current_boh_tenant_id_advisor_impl()
  )
$$;

create or replace function private.is_boh_super_admin_advisor_impl()
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1
    from public.boh_user_role bur
    join public.boh_role br on br.id = bur.role_id
    join public.boh_user bu on bu.id = bur.user_id
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bu.status = 'active'
      and bur.app_context = 'boh'
      and bur.tenant_id = bu.tenant_id
      and bu.tenant_id = private.current_boh_tenant_id_advisor_impl()
      and br.code = 'super_admin'
  )
$$;

create or replace function private.get_quarterly_metrics_advisor_impl(p_quarter text, p_year integer)
returns table(
  total_initiatives bigint,
  active_initiatives bigint,
  completed_initiatives bigint,
  total_releases bigint,
  major_releases bigint,
  minor_releases bigint,
  total_tickets bigint,
  internal_tickets bigint,
  external_tickets bigint,
  average_initiative_progress numeric,
  releases_per_initiative numeric
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_tenant_id uuid := private.current_boh_tenant_id_advisor_impl();
begin
  if v_tenant_id is null then
    return query select 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::numeric,0::numeric;
    return;
  end if;

  return query
  with initiative_metrics as (
    select count(*) as total,
      count(*) filter (where status in ('planned','in progress')) as active,
      count(*) filter (where status = 'done') as completed,
      avg(progress) as avg_progress
    from public.boh_initiative
    where tenant_id = v_tenant_id
      and target_quarter = p_quarter
      and target_year = p_year
      and is_archived = false
  ), release_metrics as (
    select count(*) as total,
      count(*) filter (where release_tier = 'major') as major,
      count(*) filter (where release_tier = 'minor') as minor
    from public.boh_release_version
    where tenant_id = v_tenant_id
      and quarter = p_quarter
      and year = p_year
  ), ticket_metrics as (
    select count(*) as total,
      count(*) filter (where ct.app_context = 'boh') as internal,
      count(*) filter (where ct.app_context <> 'boh') as external
    from public.counter_ticket ct
    where ct.tenant_id = v_tenant_id
      and ct.created_at >= make_date(p_year, (substring(p_quarter,2,1)::integer - 1) * 3 + 1, 1)
      and ct.created_at < make_date(p_year, substring(p_quarter,2,1)::integer * 3 + 1, 1)
  )
  select im.total,im.active,im.completed,rm.total,rm.major,rm.minor,
    tm.total,tm.internal,tm.external,coalesce(im.avg_progress,0),
    case when im.total > 0 then round(rm.total::numeric / im.total::numeric,2) else 0 end
  from initiative_metrics im, release_metrics rm, ticket_metrics tm;
end;
$$;

create or replace function private.slotz_resolve_public_staff_advisor_impl(p_tenant_slug text, p_staff_slug text)
returns table(id uuid,user_id uuid,full_name text,email text,slug text,timezone text,meeting_link text,tenant_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sp.id,sp.user_id,sp.full_name,sp.email,sp.slug,sp.timezone,sp.meeting_link,sp.tenant_id
  from public.scheduling_staff_profiles sp
  join public.boh_tenant bt on bt.id = sp.tenant_id
  where bt.slug = p_tenant_slug and sp.slug = p_staff_slug
  limit 1
$$;

revoke all on function private.current_boh_tenant_id_advisor_impl() from public, anon;
revoke all on function private.is_boh_staff_advisor_impl() from public, anon;
revoke all on function private.is_boh_super_admin_advisor_impl() from public, anon;
revoke all on function private.get_quarterly_metrics_advisor_impl(text,integer) from public, anon;
revoke all on function private.slotz_resolve_public_staff_advisor_impl(text,text) from public;
grant execute on function private.current_boh_tenant_id_advisor_impl() to authenticated, service_role;
grant execute on function private.is_boh_staff_advisor_impl() to authenticated, service_role;
grant execute on function private.is_boh_super_admin_advisor_impl() to authenticated, service_role;
grant execute on function private.get_quarterly_metrics_advisor_impl(text,integer) to authenticated, service_role;
grant execute on function private.slotz_resolve_public_staff_advisor_impl(text,text) to anon, authenticated, service_role;

create or replace function public.current_boh_tenant_id()
returns uuid language sql stable security invoker set search_path = private, pg_temp
as $$ select private.current_boh_tenant_id_advisor_impl() $$;

create or replace function public.is_boh_staff()
returns boolean language sql stable security invoker set search_path = private, pg_temp
as $$ select private.is_boh_staff_advisor_impl() $$;

create or replace function public.is_boh_super_admin()
returns boolean language sql stable security invoker set search_path = private, pg_temp
as $$ select private.is_boh_super_admin_advisor_impl() $$;

create or replace function public.get_quarterly_metrics(p_quarter text,p_year integer)
returns table(
  total_initiatives bigint,active_initiatives bigint,completed_initiatives bigint,
  total_releases bigint,major_releases bigint,minor_releases bigint,
  total_tickets bigint,internal_tickets bigint,external_tickets bigint,
  average_initiative_progress numeric,releases_per_initiative numeric
)
language sql stable security invoker set search_path = private, pg_temp
as $$ select * from private.get_quarterly_metrics_advisor_impl(p_quarter,p_year) $$;

create or replace function public.slotz_resolve_public_staff(p_tenant_slug text,p_staff_slug text)
returns table(id uuid,user_id uuid,full_name text,email text,slug text,timezone text,meeting_link text,tenant_id uuid)
language sql stable security invoker set search_path = private, pg_temp
as $$ select * from private.slotz_resolve_public_staff_advisor_impl(p_tenant_slug,p_staff_slug) $$;

revoke all on function public.current_boh_tenant_id() from public, anon;
revoke all on function public.is_boh_staff() from public, anon;
revoke all on function public.is_boh_super_admin() from public, anon;
revoke all on function public.get_quarterly_metrics(text,integer) from public, anon;
revoke all on function public.slotz_resolve_public_staff(text,text) from public;
grant execute on function public.current_boh_tenant_id() to authenticated, service_role;
grant execute on function public.is_boh_staff() to authenticated, service_role;
grant execute on function public.is_boh_super_admin() to authenticated, service_role;
grant execute on function public.get_quarterly_metrics(text,integer) to authenticated, service_role;
grant execute on function public.slotz_resolve_public_staff(text,text) to anon, authenticated, service_role;

commit;
