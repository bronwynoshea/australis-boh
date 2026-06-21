-- BOH-dev only: lczzeiqmnegyjrwtgmsj
-- Fix remaining Supabase linter warnings from 2026-06-02.

alter function public.set_central_credentials_updated_at()
  set search_path = public, pg_temp;

drop policy if exists "cellar_team_members_staff_read" on public.cellar_team_members;

create policy "cellar_team_members_staff_read"
  on public.cellar_team_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = (select auth.uid())
        and bu.app_context = 'boh'
    )
  );

revoke execute on function public.cellar_current_boh_user_id() from authenticated;
revoke execute on function public.cellar_current_boh_user_id() from anon;
revoke execute on function public.cellar_current_boh_user_id() from public;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.proconfig,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_central_credentials_updated_at',
    'cellar_current_boh_user_id'
  )
order by p.proname, args;

select
  policyname,
  roles::text as roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'cellar_team_members'
  and policyname = 'cellar_team_members_staff_read';
