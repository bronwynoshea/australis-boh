-- BOH login bootstrap RLS fix, part 03.
-- Run this after part 02.

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
