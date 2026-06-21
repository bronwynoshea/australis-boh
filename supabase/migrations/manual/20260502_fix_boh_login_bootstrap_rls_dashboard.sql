-- Dashboard-safe copy of 20260502_fix_boh_login_bootstrap_rls.sql.
-- Run in the Supabase SQL editor for the affected project.

grant usage on schema public to authenticated;

grant select on public.boh_user to authenticated;
grant select on public.boh_role to authenticated;
grant select on public.boh_app to authenticated;
grant select on public.boh_user_role to authenticated;
grant select on public.boh_user_app to authenticated;

grant update (auth_user_id) on public.boh_user to authenticated;

create or replace function public.current_boh_user_id()
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

create or replace function public.is_boh_super_admin()
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

grant execute on function public.current_boh_user_id() to authenticated;
grant execute on function public.is_boh_super_admin() to authenticated;

do $$
declare
  helper record;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_boh_user'
  loop
    execute format('grant execute on function %s to authenticated', helper.signature);
  end loop;
end $$;

alter table public.boh_user enable row level security;
alter table public.boh_role enable row level security;
alter table public.boh_app enable row level security;
alter table public.boh_user_role enable row level security;
alter table public.boh_user_app enable row level security;

drop policy if exists "boh_user_select_login_bootstrap" on public.boh_user;
create policy "boh_user_select_login_bootstrap"
  on public.boh_user
  for select
  to authenticated
  using (
    app_context = 'boh'
    and (
      auth_user_id = (select auth.uid())
      or lower(email) = lower((select auth.jwt() ->> 'email'))
      or public.is_boh_super_admin()
    )
  );

drop policy if exists "boh_user_link_invited_auth_user" on public.boh_user;
create policy "boh_user_link_invited_auth_user"
  on public.boh_user
  for update
  to authenticated
  using (
    app_context = 'boh'
    and auth_user_id is null
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  )
  with check (
    app_context = 'boh'
    and auth_user_id = (select auth.uid())
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  );

drop policy if exists "boh_role_select_authenticated" on public.boh_role;
create policy "boh_role_select_authenticated"
  on public.boh_role
  for select
  to authenticated
  using (true);

drop policy if exists "boh_app_select_active_bootstrap" on public.boh_app;
create policy "boh_app_select_active_bootstrap"
  on public.boh_app
  for select
  to authenticated
  using (
    is_active = true
    and coalesce(app_context, 'boh') = 'boh'
  );

drop policy if exists "boh_user_role_select_bootstrap" on public.boh_user_role;
create policy "boh_user_role_select_bootstrap"
  on public.boh_user_role
  for select
  to authenticated
  using (
    app_context = 'boh'
    and (
      user_id = public.current_boh_user_id()
      or public.is_boh_super_admin()
    )
  );

drop policy if exists "boh_user_app_select_bootstrap" on public.boh_user_app;
create policy "boh_user_app_select_bootstrap"
  on public.boh_user_app
  for select
  to authenticated
  using (
    app_context = 'boh'
    and (
      user_id = public.current_boh_user_id()
      or public.is_boh_super_admin()
    )
  );
