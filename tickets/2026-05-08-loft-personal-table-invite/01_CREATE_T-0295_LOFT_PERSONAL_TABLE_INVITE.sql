begin;

with lookups as (
  select
    (select id from public.counter_ticket_status where key = 'new' and is_active = true limit 1) as status_id,
    (select id from public.counter_ticket_priority where key = 'medium' and is_active = true limit 1) as priority_id,
    (select id from public.boh_app where slug = 'loft' limit 1) as app_id
),
validated as (
  select *
  from lookups
  where status_id is not null
    and priority_id is not null
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
    'T-0295',
    'Polish Loft Personal Table invite workflow',
    $$Polish the JOBZCAFE® Loft Personal Table host invite surface so it feels native to the Loft app. Scope completed in local staging: simplify the host page hierarchy, keep Join as Host and Copy guest link as matched top actions, hide the raw guest URL from the main screen, keep the email template readable without internal scrolling, and make the previewed Join my Personal Table text look like a link while copied invite text still includes the working URL.$$,
    'loft_personal_table',
    'loft',
    app_id,
    'loft',
    'Bronwyn O''Shea',
    'bronwyn@jobzcafe.com',
    'codex',
    $$User requested the Personal Table page be made more professional and aligned with the rest of Loft, with no visible raw URL in the primary invite controls and no extra dashboard-style helper blocks.$$,
    status_id,
    priority_id,
    now(),
    now()
  from validated
  where not exists (
    select 1 from public.counter_ticket where ticket_number = 'T-0295'
  )
  returning ticket_number
)
select
  case
    when (select count(*) from validated) = 0 then 'missing lookup: status, priority, or loft app'
    when exists (select 1 from inserted) then 'created T-0295'
    else 'T-0295 already exists; no insert'
  end as result;

commit;
