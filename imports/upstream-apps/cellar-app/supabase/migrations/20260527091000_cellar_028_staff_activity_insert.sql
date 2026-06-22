-- CELLAR staff activity logging for contact and pipeline audit trails.
drop policy if exists cellar_activity_events_staff_insert on public.cellar_activity_events;
create policy cellar_activity_events_staff_insert on public.cellar_activity_events
  for insert with check (
    cellar_private.current_boh_user_id() is not null
    and actor_kind = 'staff'
    and actor_boh_user_id = cellar_private.current_boh_user_id()
  );
