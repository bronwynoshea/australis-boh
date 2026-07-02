begin;

with lookups as (
  select
    (select id from public.counter_ticket_status where key = 'new' and is_active = true limit 1) as status_id,
    (select id from public.counter_ticket_priority where key = 'high' and is_active = true limit 1) as high_priority_id,
    (select id from public.counter_ticket_priority where key = 'medium' and is_active = true limit 1) as medium_priority_id,
    (
      select id
      from public.boh_app
      where lower(coalesce(slug, '')) = 'slotz'
         or lower(coalesce(name, '')) = 'slotz'
         or lower(coalesce(app_context, '')) = 'slotz'
      order by sort_order nulls last, name
      limit 1
    ) as app_id
),
rows(ticket_number, subject, description, priority_key) as (
  values
    (
      'T-2099',
      'Fix SLOTZ OAuth callback URLs and dev/prod auth isolation',
      $$SLOTZ BOH-dev and BOH/prod OAuth testing found two environment issues: callbacks can redirect to localhost when SLOTZ_APP_URL is wrong, and old shared auth cookies can cross-contaminate BOH-dev and BOH/prod sessions. Source fix 57ca310 scopes frontend auth storage by Supabase project. Remaining work: promote the commit, redeploy frontend, clear the old shared cookie once, verify BOH-dev SLOTZ_APP_URL is https://dev-slotz.jobzcafe.com and BOH/prod SLOTZ_APP_URL is https://slotz.jobzcafe.com, then retest Outlook and Google callbacks.$$,
      'high'
    ),
    (
      'T-2100',
      'Complete SLOTZ Outlook and Google calendar sync smoke tests',
      $$Complete calendar integration smoke tests after the OAuth environment fix lands. Verify Outlook and Google connect, reconnect, disconnect, status display, initial sync, manual sync, external event display, and booking-created/rescheduled/canceled calendar behavior in BOH-dev first and then BOH/prod. Any Edge Function 401/403/500 must surface visibly and be fixed without silent production-data fallback.$$,
      'high'
    ),
    (
      'T-2101',
      'Verify SLOTZ reminder queue worker delivery in BOH-dev and BOH/prod',
      $$Reminder queue workers were changed to process due scheduling_reminder_jobs and handle Resend 429 rate limits more safely. Verify cron schedules, due job processing, guest and staff email delivery, failed-job retry behavior, and scheduling_email_events logging in BOH-dev first and BOH/prod after approval. Keep SQL changes human-gated for BOH/prod.$$,
      'medium'
    )
),
prepared as (
  select
    r.*,
    l.status_id,
    case r.priority_key when 'high' then l.high_priority_id else l.medium_priority_id end as priority_id,
    l.app_id
  from rows r
  cross join lookups l
  where l.status_id is not null and l.app_id is not null
),
inserted as (
  insert into public.counter_ticket (
    ticket_number, subject, description, category, app, app_id, app_context,
    requester_name, requester_email, source, initial_user_message,
    status_id, priority_id, created_at, updated_at
  )
  select
    ticket_number, subject, description, 'slotz_promotion', 'slotz', app_id, 'slotz',
    'Bronwyn O''Shea', 'bronwyn@jobzcafe.com', 'codex',
    'SLOTZ BOH-dev to BOH/prod promotion follow-up created after live ticket duplicate check.',
    status_id, priority_id, now(), now()
  from prepared p
  where p.priority_id is not null
    and not exists (select 1 from public.counter_ticket t where t.ticket_number = p.ticket_number)
  returning ticket_number
)
select count(*) as tickets_inserted
from inserted;

commit;
