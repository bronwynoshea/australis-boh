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
      'T-0297',
      '[[slotz_calendar_prod_closeout_20260520]]',
      $$[[slotz_calendar_prod_closeout_20260520]]
Status: OPEN - promotion smoke moved past calendar integrations; reminder queues remain the next verification area.

Calendar closeout:
- BOH-dev was used as the source of truth before prod testing resumed.
- Outlook reconnect and sync were retested successfully.
- Google connect, sync, disconnect, reconnect, and external event display were retested successfully.
- Prod was then updated with the same dev-proven frontend and Edge Function path.

Important correction:
- Earlier SLOTZ_APP_URL secret suspicion was not the core failure. The durable fixes were project-scoped frontend auth storage, carrying the app origin through signed OAuth state, and routing Google disconnect through a staff Edge Function instead of direct browser writes blocked by RLS.

Remaining release sign-off:
- Reminder queue delivery and logging still need final BOH-dev and BOH/prod verification.

Release allocation: not allocated.$$
    ),
    (
      'T-2099',
      '[[slotz_oauth_environment_closeout_20260520]]',
      $$[[slotz_oauth_environment_closeout_20260520]]
Status: CLOSED IN SOURCE - release allocation needed.

Resolved in source:
- Frontend auth storage is scoped by Supabase project.
- Outlook and Google OAuth connect flows carry the current SLOTZ app origin through signed state.
- Callback redirects no longer depend solely on SLOTZ_APP_URL for normal connect flows.
- Dev and prod were tested after deploying the updated frontend and Edge Functions.

Release allocation: not allocated.$$
    ),
    (
      'T-2100',
      '[[slotz_calendar_smoke_closeout_20260520]]',
      $$[[slotz_calendar_smoke_closeout_20260520]]
Status: CLOSED IN SOURCE - release allocation needed.

Calendar smoke result:
- BOH-dev passed first, including Outlook reconnect/sync and Google connect/sync/disconnect/reconnect.
- Google external event sync was confirmed by adding a test event and seeing it appear in SLOTZ as an External Booking.
- BOH/prod then passed the same calendar integration smoke path.

Follow-up:
- Continue with reminder queue verification separately under T-2101.

Release allocation: not allocated.$$
    ),
    (
      'T-2101',
      '[[slotz_reminder_queue_next_20260520]]',
      $$[[slotz_reminder_queue_next_20260520]]
Status: OPEN - implementation deployed but final delivery smoke remains.

Calendar integrations are now separated from reminder queue verification. Next step is to verify cron schedules, due job processing, guest/staff reminder email delivery, failed-job retry behavior, and scheduling_email_events logging in BOH-dev first, then BOH/prod after approval.

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
