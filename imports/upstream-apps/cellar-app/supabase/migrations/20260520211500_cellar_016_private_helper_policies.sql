-- CELLAR policy refresh to use non-exposed private helper functions.
drop policy if exists cellar_guest_access_codes_staff_all on public.cellar_guest_access_codes;
create policy cellar_guest_access_codes_staff_all on public.cellar_guest_access_codes
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_investor_access_staff_all on public.cellar_investor_access;
create policy cellar_investor_access_staff_all on public.cellar_investor_access
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_investor_sessions_staff_read on public.cellar_investor_sessions;
create policy cellar_investor_sessions_staff_read on public.cellar_investor_sessions
  for select using (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_staff_visibility_staff_all on public.cellar_staff_visibility_permissions;
create policy cellar_staff_visibility_staff_all on public.cellar_staff_visibility_permissions
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_activity_events_staff_read on public.cellar_activity_events;
create policy cellar_activity_events_staff_read on public.cellar_activity_events
  for select using (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_activity_events_verified_self_read on public.cellar_activity_events;
create policy cellar_activity_events_verified_self_read on public.cellar_activity_events
  for select using (investor_access_id is not null and cellar_private.is_verified_investor(investor_access_id));

drop policy if exists cellar_message_threads_staff_all on public.cellar_message_threads;
create policy cellar_message_threads_staff_all on public.cellar_message_threads
  for all using (cellar_private.staff_can_access_investor(investor_access_id))
  with check (cellar_private.staff_can_access_investor(investor_access_id));

drop policy if exists cellar_message_threads_verified_self_read on public.cellar_message_threads;
create policy cellar_message_threads_verified_self_read on public.cellar_message_threads
  for select using (cellar_private.is_verified_investor(investor_access_id));

drop policy if exists cellar_messages_staff_all on public.cellar_messages;
create policy cellar_messages_staff_all on public.cellar_messages
  for all using (cellar_private.staff_can_access_investor(investor_access_id))
  with check (cellar_private.staff_can_access_investor(investor_access_id));

drop policy if exists cellar_messages_verified_self_read on public.cellar_messages;
create policy cellar_messages_verified_self_read on public.cellar_messages
  for select using (cellar_private.is_verified_investor(investor_access_id));

drop policy if exists cellar_booking_link_audits_staff_read on public.cellar_booking_link_audits;
create policy cellar_booking_link_audits_staff_read on public.cellar_booking_link_audits
  for select using (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_booking_link_audits_verified_self_read on public.cellar_booking_link_audits;
create policy cellar_booking_link_audits_verified_self_read on public.cellar_booking_link_audits
  for select using (investor_access_id is not null and cellar_private.is_verified_investor(investor_access_id));
