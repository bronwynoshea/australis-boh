-- Run in BOH-DEV third. Chunk 3 of 4: submit helper comments, RLS, grants.
comment on function public.cellar_submit_investor_profile(uuid, text, text, text, text, text, text, jsonb) is
  'CELLAR service helper: creates/updates Patron CRM person, access entitlement, and investor profile without granting verified access.';

alter table public.cellar_investor_profiles enable row level security;

drop policy if exists cellar_investor_profiles_staff_all on public.cellar_investor_profiles;
create policy cellar_investor_profiles_staff_all on public.cellar_investor_profiles
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);

drop policy if exists cellar_investor_profiles_self_read on public.cellar_investor_profiles;
create policy cellar_investor_profiles_self_read on public.cellar_investor_profiles
  for select using (auth.uid() is not null and auth_user_id = auth.uid());

revoke execute on function public.cellar_submit_investor_profile(uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cellar_submit_investor_profile(uuid, text, text, text, text, text, text, jsonb) to service_role;
