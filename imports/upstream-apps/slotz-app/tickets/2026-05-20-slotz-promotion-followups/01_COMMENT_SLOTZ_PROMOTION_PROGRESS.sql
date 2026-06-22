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
      '[[slotz_boh_promotion_progress_20260520]]',
      $$[[slotz_boh_promotion_progress_20260520]]
Status: OPEN - BOH/prod promotion is in final smoke-test and configuration hardening.

Completed:
- BOH/prod schema, trigger, cron, and core Edge Function promotion steps were prepared and verified.
- SLOTZ Edge Function slugs are active in BOH/prod with slotz- prefixes.
- Calendar auth functions now use project-native Supabase secrets where possible.
- Reminder queue workers now process due jobs and retry Resend rate limits more safely.
- Frontend auth storage is now scoped by Supabase project to stop BOH-dev and BOH/prod session-cookie collisions.

Still required before release sign-off:
- Promote latest codex-staging changes through staging/main and redeploy frontend.
- Correct and verify SLOTZ_APP_URL per environment so OAuth callbacks do not redirect to localhost.
- Retest Outlook, Google, reminder queues, and production smoke checklist.

Release allocation: not allocated.$$
    ),
    (
      'T-0058',
      '[[slotz_calendar_promotion_followup_20260520]]',
      $$[[slotz_calendar_promotion_followup_20260520]]
Status: OPEN - historical Outlook hookup is no longer enough for release sign-off.

The current SLOTZ release scope includes Outlook, Google Calendar, environment-specific OAuth callback URLs, and BOH-dev/BOH/prod parity. Keep this ticket as historical context and use the new 2026-05-20 follow-up tickets for the active release blockers.

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
    ticket_id,
    author_id,
    body,
    is_visible_to_requester,
    should_notify_requester,
    app_context,
    created_at
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
