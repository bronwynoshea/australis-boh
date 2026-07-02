-- CELLAR private helper schema for RLS and service-mediated checks.
create schema if not exists cellar_private;
grant usage on schema cellar_private to anon, authenticated, service_role;

create or replace function cellar_private.current_boh_user_id()
returns text language plpgsql stable security definer set search_path = public as $$
declare cellar_boh_user_id text;
begin
  if auth.uid() is null or to_regclass('public.boh_user') is null then return null; end if;
  execute 'select id::text from public.boh_user where auth_user_id = $1 limit 1'
    into cellar_boh_user_id using auth.uid();
  return cellar_boh_user_id;
end;
$$;

create or replace function cellar_private.is_verified_investor(p_investor_access_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cellar_investor_access as cia
    where cia.id = p_investor_access_id
      and cia.auth_user_id = auth.uid()
      and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  )
$$;

create or replace function cellar_private.current_investor_access_status()
returns text language sql stable security definer set search_path = public as $$
  select cia.access_status
  from public.cellar_investor_access as cia
  where cia.auth_user_id = auth.uid()
    and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  order by cia.verified_at desc nulls last, cia.created_at desc
  limit 1
$$;

create or replace function cellar_private.has_verified_investor_access()
returns boolean language sql stable security definer set search_path = public as $$
  select cellar_private.current_investor_access_status() is not null
$$;

create or replace function cellar_private.staff_can_access_investor(p_investor_access_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cellar_boh_user_id text := cellar_private.current_boh_user_id();
begin
  if cellar_boh_user_id is null then return false; end if;
  if exists (
    select 1 from public.cellar_staff_visibility_permissions csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level = 'hidden'
      and (csvp.expires_at is null or csvp.expires_at > now())
  ) then return false; end if;
  if exists (
    select 1 from public.cellar_investor_access cia
    where cia.id = p_investor_access_id and cia.assigned_boh_user_id = cellar_boh_user_id
  ) then return true; end if;
  return exists (
    select 1 from public.cellar_staff_visibility_permissions csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level in ('viewer', 'responder', 'owner')
      and (csvp.expires_at is null or csvp.expires_at > now())
  );
end;
$$;

grant execute on all functions in schema cellar_private to anon, authenticated, service_role;
