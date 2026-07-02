-- Harden Loft video-session bridge tenant boundaries.
-- The bridge is BOH/Talent-owned business data, so authenticated clients may
-- read only rows for their current tenant. Writes stay service-role/API-only.

begin;

revoke all on table public.loft_video_session from anon;
revoke insert, update, delete, truncate, references, trigger on table public.loft_video_session from authenticated;
grant select on table public.loft_video_session to authenticated;

alter table public.loft_video_session enable row level security;

drop policy if exists "loft_video_session_select_current_tenant" on public.loft_video_session;
create policy "loft_video_session_select_current_tenant"
  on public.loft_video_session
  for select
  to authenticated
  using (tenant_id = public.current_boh_tenant_id());

commit;
