-- BOH login bootstrap RLS fix, part 02.
-- Run this after part 01.

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
