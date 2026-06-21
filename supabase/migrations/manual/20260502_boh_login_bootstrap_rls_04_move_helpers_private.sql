-- BOH login bootstrap RLS fix, part 04.
-- Run after parts 01-03 to remove public RPC exposure warnings.

create schema if not exists private;

grant usage on schema private to authenticated;

create or replace function private.current_boh_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bu.id
  from public.boh_user bu
  where bu.auth_user_id = (select auth.uid())
    and bu.app_context = 'boh'
  limit 1
$$;

create or replace function private.is_boh_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.boh_user_role bur
    join public.boh_role br on br.id = bur.role_id
    join public.boh_user bu on bu.id = bur.user_id
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bur.app_context = 'boh'
      and br.code = 'super_admin'
  )
$$;

revoke execute on function public.current_boh_user_id() from anon, authenticated;
revoke execute on function public.is_boh_super_admin() from anon, authenticated;
revoke execute on function public.is_boh_user() from anon, authenticated;
revoke execute on function public.is_boh_user(uuid) from anon, authenticated;

grant execute on function private.current_boh_user_id() to authenticated;
grant execute on function private.is_boh_super_admin() to authenticated;

drop policy if exists "boh_user_select_login_bootstrap" on public.boh_user;
create policy "boh_user_select_login_bootstrap"
  on public.boh_user for select to authenticated
  using (
    app_context = 'boh'
    and (
      auth_user_id = (select auth.uid())
      or lower(email) = lower((select auth.jwt() ->> 'email'))
      or private.is_boh_super_admin()
    )
  );

drop policy if exists "boh_user_role_select_bootstrap" on public.boh_user_role;
create policy "boh_user_role_select_bootstrap"
  on public.boh_user_role for select to authenticated
  using (
    app_context = 'boh'
    and (
      user_id = private.current_boh_user_id()
      or private.is_boh_super_admin()
    )
  );

drop policy if exists "boh_user_app_select_bootstrap" on public.boh_user_app;
create policy "boh_user_app_select_bootstrap"
  on public.boh_user_app for select to authenticated
  using (
    app_context = 'boh'
    and (
      user_id = private.current_boh_user_id()
      or private.is_boh_super_admin()
    )
  );
