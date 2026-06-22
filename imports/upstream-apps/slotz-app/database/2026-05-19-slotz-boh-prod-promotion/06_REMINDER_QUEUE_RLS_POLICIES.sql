-- Add explicit read-only staff policies for reminder workflow visibility.
-- Writes remain restricted to service-role Edge Functions and trigger functions.
-- Safe to run more than once.

drop policy if exists "staff can read reminder jobs for own bookings"
  on public.scheduling_reminder_jobs;

create policy "staff can read reminder jobs for own bookings"
  on public.scheduling_reminder_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.scheduling_bookings b
      join public.scheduling_staff_profiles sp
        on sp.id = b.staff_id
      where b.id = scheduling_reminder_jobs.booking_id
        and sp.user_id = (select auth.uid())
    )
  );

drop policy if exists "staff can read email events for own bookings"
  on public.scheduling_email_events;

create policy "staff can read email events for own bookings"
  on public.scheduling_email_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.scheduling_bookings b
      join public.scheduling_staff_profiles sp
        on sp.id = b.staff_id
      where b.id = scheduling_email_events.booking_id
        and sp.user_id = (select auth.uid())
    )
  );
