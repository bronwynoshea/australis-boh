-- CELLAR core RLS policies. Service-role Edge Functions may mediate guest flows.
alter table public.cellar_guest_access_codes enable row level security;
alter table public.cellar_investor_access enable row level security;
alter table public.cellar_investor_sessions enable row level security;
alter table public.cellar_staff_visibility_permissions enable row level security;
alter table public.cellar_activity_events enable row level security;
alter table public.cellar_message_threads enable row level security;
alter table public.cellar_messages enable row level security;
alter table public.cellar_booking_link_audits enable row level security;

create policy cellar_guest_access_codes_staff_all on public.cellar_guest_access_codes
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);

create policy cellar_investor_access_staff_all on public.cellar_investor_access
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);

create policy cellar_investor_access_verified_self_read on public.cellar_investor_access
  for select using (auth.uid() is not null and auth_user_id = auth.uid());

create policy cellar_investor_sessions_staff_read on public.cellar_investor_sessions
  for select using (public.cellar_current_boh_user_id() is not null);

create policy cellar_staff_visibility_staff_all on public.cellar_staff_visibility_permissions
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);

create policy cellar_activity_events_staff_read on public.cellar_activity_events
  for select using (public.cellar_current_boh_user_id() is not null);

create policy cellar_activity_events_verified_self_read on public.cellar_activity_events
  for select using (investor_access_id is not null and public.cellar_is_verified_investor(investor_access_id));

create policy cellar_message_threads_staff_all on public.cellar_message_threads
  for all using (public.cellar_staff_can_access_investor(investor_access_id))
  with check (public.cellar_staff_can_access_investor(investor_access_id));

create policy cellar_message_threads_verified_self_read on public.cellar_message_threads
  for select using (public.cellar_is_verified_investor(investor_access_id));

create policy cellar_messages_staff_all on public.cellar_messages
  for all using (public.cellar_staff_can_access_investor(investor_access_id))
  with check (public.cellar_staff_can_access_investor(investor_access_id));

create policy cellar_messages_verified_self_read on public.cellar_messages
  for select using (public.cellar_is_verified_investor(investor_access_id));

create policy cellar_booking_link_audits_staff_read on public.cellar_booking_link_audits
  for select using (public.cellar_current_boh_user_id() is not null);

create policy cellar_booking_link_audits_verified_self_read on public.cellar_booking_link_audits
  for select using (investor_access_id is not null and public.cellar_is_verified_investor(investor_access_id));
