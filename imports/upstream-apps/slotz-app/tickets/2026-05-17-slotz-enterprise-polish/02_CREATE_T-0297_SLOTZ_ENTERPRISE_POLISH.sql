begin;

with lookups as (
  select
    (select id from public.counter_ticket_status where key = 'new' and is_active = true limit 1) as status_id,
    (
      select id
      from public.counter_ticket_priority
      where key in ('medium', 'normal') and is_active = true
      order by case key when 'medium' then 1 else 2 end
      limit 1
    ) as priority_id,
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
    'T-0297',
    'Continue SLOTZ enterprise polish pass',
    $$Continue the SLOTZ enterprise polish pass after Outlook connection testing. Work through the app screen by screen: login page final polish, global visual system, app shell/navigation, staff dashboard and agenda, settings screens, public booking/manage pages, Outlook integration UX, feedback and messaging, responsive QA, accessibility, and production readiness. Keep SLOTZ naming, dark-only theme direction, no silent production-data fallbacks, and BOH-dev verification before production promotion.$$,
    'slotz_polish',
    'slotz',
    app_id,
    'slotz',
    'Bronwyn O''Shea',
    'bronwyn@jobzcafe.com',
    'codex',
    $$User requested a ticket update for the completed SLOTZ Outlook testing and the remaining enterprise-quality polish work. The login page polish has started with custom SLOTZ logo, generated scheduling hero image, ghost panel, and right-panel color tuning. Continue systematically from the enterprise polish work order.$$,
    status_id,
    priority_id,
    now(),
    now()
  from validated
  where not exists (
    select 1 from public.counter_ticket where ticket_number = 'T-0297'
  )
  returning ticket_number
)
select
  case
    when (select count(*) from validated) = 0 then 'missing lookup: status, priority, or slotz app'
    when exists (select 1 from inserted) then 'created T-0297'
    else 'T-0297 already exists; no insert'
  end as result;

commit;
