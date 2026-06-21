begin;

with lookups as (
  select
    (select id from public.counter_ticket_status where key = 'new' and is_active = true limit 1) as status_id,
    (select id from public.counter_ticket_priority where key = 'high' and is_active = true limit 1) as priority_id,
    (select id from public.boh_app where slug = 'loft' limit 1) as app_id
),
validated as (
  select *
  from lookups
  where status_id is not null
    and priority_id is not null
    and app_id is not null
),
inserted as (
  insert into public.counter_ticket (
    ticket_number,
    subject,
    description,
    category,
    app,
    app_id,
    app_context,
    requester_name,
    requester_email,
    source,
    initial_user_message,
    status_id,
    priority_id,
    created_at,
    updated_at
  )
  select
    'T-0304',
    'Fix Loft Personal Table live session QA regressions',
    $$Fix JOBZCAFE® Loft Personal Table live-session regressions found during external QA: leave cleanup alert, stale departed guest tiles, guest layout controls, layout video reattachment, and stalled screen sharing after the browser picker or shared track fails to produce content.$$,
    'loft_personal_table_live_qa',
    'loft',
    app_id,
    'loft',
    'Bronwyn O''Shea',
    'bronwyn@jobzcafe.com',
    'codex',
    $$User reported that leaving a Personal Table showed a guest request cleanup alert, departed guests stayed visible to the host, external guests lacked layout controls, sidebar/spotlight could blank video until toggled, and external screen share could get stuck waiting for content.$$,
    status_id,
    priority_id,
    now(),
    now()
  from validated
  where not exists (
    select 1 from public.counter_ticket where ticket_number = 'T-0304'
  )
  returning ticket_number
)
select
  case
    when (select count(*) from validated) = 0 then 'missing lookup: status, priority, or loft app'
    when exists (select 1 from inserted) then 'created T-0304'
    else 'T-0304 already exists; no insert'
  end as result;

commit;
