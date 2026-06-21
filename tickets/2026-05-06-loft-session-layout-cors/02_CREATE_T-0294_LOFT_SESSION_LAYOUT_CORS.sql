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
    'T-0294',
    'Finalize Loft session layout and CORS hardening',
    $$Finalize the JOBZCAFE® Loft session/table hardening completed in local staging. Scope: keep Loft Edge Function CORS origins explicit with no hardcoded app.jobzcafe.com and no silent fallback origins; validate localhost, dev-loft.jobzcafe.com, and loft.jobzcafe.com; preserve session joining through approved service paths rather than direct browser RLS reads; polish the host stage card, participant rail, laptop height breakpoints, hidden horizontal scrolling, personal-table tint removal, and listener-card space recovery so the experience feels enterprise-grade.$$,
    'loft_hardening',
    'loft',
    app_id,
    'loft',
    'Bronwyn O''Shea',
    'bronwyn@jobzcafe.com',
    'codex',
    $$User requested BOH Counter coverage after resolving Loft CORS and session/table layout issues, including laptop transport spacing, centered desktop participant cards, no participant background tint, no unnecessary listener controls, and no hardcoded CORS origins or fallback behavior.$$,
    status_id,
    priority_id,
    now(),
    now()
  from validated
  where not exists (
    select 1 from public.counter_ticket where ticket_number = 'T-0294'
  )
  returning ticket_number
)
select
  case
    when (select count(*) from validated) = 0 then 'missing lookup: status, priority, or loft app'
    when exists (select 1 from inserted) then 'created T-0294'
    else 'T-0294 already exists; no insert'
  end as result;

commit;
