-- CELLAR investor profile staff policy should use the private BOH resolver.
drop policy if exists cellar_investor_profiles_staff_all on public.cellar_investor_profiles;

create policy cellar_investor_profiles_staff_all on public.cellar_investor_profiles
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);
