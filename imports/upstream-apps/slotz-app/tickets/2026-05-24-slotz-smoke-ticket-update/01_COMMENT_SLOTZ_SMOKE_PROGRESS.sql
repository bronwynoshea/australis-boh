begin;

with author as (
  select id
  from public.boh_user
  where app_context = 'boh'
  order by created_at asc
  limit 1
),
updates(ticket_number, marker, body) as (
  values
    (
      'T-0300',
      '[[slotz_oauth_auth_closeout_20260524]]',
      $$[[slotz_oauth_auth_closeout_20260524]]
Status: CLOSED IN SOURCE - release allocation needed.
Resolved in SLOTZ source and smoke testing:
- Frontend auth sessions are now scoped by Supabase project to prevent BOH-dev and BOH/prod cookie collision.
- Calendar OAuth flows carry the SLOTZ app origin through signed state so dev and prod callbacks return to the correct frontend.
- Google disconnect now routes through a staff Edge Function instead of direct browser writes blocked by RLS.
- Dev and prod calendar connection paths were retested after frontend and Edge Function deployment.

Release allocation: not allocated.$$
    ),
    (
      'T-0301',
      '[[slotz_calendar_smoke_closeout_20260524]]',
      $$[[slotz_calendar_smoke_closeout_20260524]]
Status: CLOSED IN SOURCE - release allocation needed.

Calendar smoke result:
- BOH-dev passed Outlook reconnect/sync and Google connect/sync/disconnect/reconnect.
- Google external event sync was confirmed by adding a test event and seeing it appear in SLOTZ as an External Booking.
- BOH/prod then passed the same calendar integration smoke path.
- Confirmation and reschedule email delivery were retested successfully during follow-up smoke testing.

Release allocation: not allocated.$$
    ),
    (
      'T-0302',
      '[[slotz_reminder_delivery_progress_20260524]]',
      $$[[slotz_reminder_delivery_progress_20260524]]
Status: OPEN - reminder delivery verification still in progress.
Progress:
- Reminder cron jobs and worker paths were separated from calendar integration closeout.
- Booking confirmation and reschedule emails are now sending during smoke testing.
- Reminder queue verification is still being observed for due 24h and 1h guest/staff reminder jobs.

Remaining:
- Confirm due scheduling_reminder_jobs move to sent with provider_message_id.
- Confirm guest and staff reminder emails appear in inboxes and Resend logs.
- Verify BOH-dev first, then BOH/prod only after approval.

Release allocation: not allocated.$$
    ),
    (
      'T-0297',
      '[[slotz_staff_booking_reschedule_polish_20260524]]',
      $$[[slotz_staff_booking_reschedule_polish_20260524]]
Status: OPEN - targeted smoke polish continues.
Completed in source during SLOTZ smoke testing:
- Staff booking detail Reschedule now opens the implemented reschedule flow instead of the old placeholder.
- Manual Booking now allows full-day staff-selected times outside public availability.
- Staff-started reschedules can select dates outside public availability while guest manage-link reschedules keep public rules.
- Reschedule flow now has a Cancel action beside Confirm New Time.

Still to follow up:
- Staff-started reschedule success currently lands on the guest-style confirmation page; internal users should return to the staff schedule with staff-facing feedback.

Release allocation: not allocated.$$
    )
),
targets as (
  select t.id, u.marker, u.body
  from updates u
  join public.counter_ticket t on t.ticket_number = u.ticket_number
),
inserted as (
  insert into public.counter_ticket_comment (
    ticket_id, author_id, body, is_visible_to_requester,
    should_notify_requester, app_context, created_at
  )
  select t.id, a.id, t.body, false, false, 'slotz', now()
  from targets t
  cross join author a
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body like '%' || t.marker || '%'
  )
  returning id
)
select count(*) as comments_inserted
from inserted;

commit;
