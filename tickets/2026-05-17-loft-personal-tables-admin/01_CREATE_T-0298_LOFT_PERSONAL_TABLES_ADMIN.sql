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
    'T-0298',
    'Add Loft superadmin Personal Tables admin flow',
    $$Implemented a JOBZCAFE® Loft superadmin Personal Tables administration flow so user_type_id 5 admins can manage member Personal Table access, invite links, and supporting review permissions from a dedicated admin surface.$$,
    'loft_personal_table_admin',
    'loft',
    app_id,
    'loft',
    'Bronwyn O''Shea',
    'bronwyn@jobzcafe.com',
    'codex',
    $$Capture completed work from a thread that hit an issue after implementation: add /admin/personal-tables, restrict navigation to user_type_id 5, support list/enable/disable/copy/rotate workflows, add authenticated JOBZCAFE-dev Edge Functions, update review-host-application for JOBZCAFE® superadmins, remove broad signed-in user shortcut, and update Loft change ledger.$$,
    status_id,
    priority_id,
    now(),
    now()
  from validated
  where not exists (
    select 1 from public.counter_ticket where ticket_number = 'T-0298'
  )
  returning ticket_number
)
select
  case
    when (select count(*) from validated) = 0 then 'missing lookup: status, priority, or loft app'
    when exists (select 1 from inserted) then 'created T-0298'
    else 'T-0298 already exists; no insert'
  end as result;

commit;
