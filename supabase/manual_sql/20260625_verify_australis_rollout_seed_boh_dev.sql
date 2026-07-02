-- BOH-DEV only: verify Australis rollout seed + first Forge workstream.
select
  'initiatives' as record_type,
  count(*)::text as count_or_key,
  string_agg(title, ' | ' order by title) as detail
from public.boh_initiative
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and title in (
    'Bootstrap Australis autonomous business foundation',
    'Australis onboarding and human profile foundation',
    'BOH billing, Patron CRM, and entitlement foundation',
    'Daily Briefing and Work Sessions foundation',
    'Australis Voice, chat, and Hermes model routing',
    'BOH adapters and future Australis agent orchestration',
    '3D Workroom and Context Graph foundation',
    'Commercial pipeline, Cookbook, Funnel, and marketing asset loop'
  )
union all
select
  'bootstrap_user_stories',
  count(*)::text,
  string_agg(us.title, ' | ' order by us.sort_order)
from public.boh_user_story us
where us.tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and us.initiative_id = (
    select id from public.boh_initiative
    where tenant_id = (select id from public.boh_tenant where slug = 'australis')
      and title = 'Bootstrap Australis autonomous business foundation'
    limit 1
  )
union all
select
  'bootstrap_workstream',
  coalesce(ws.key, 'missing'),
  coalesce(w.title, 'missing')
from (select 1) seed
left join public.boh_workstream w
  on w.tenant_id = (select id from public.boh_tenant where slug = 'australis')
 and w.title = 'Australis bootstrap and autonomous business foundation'
left join public.boh_workstream_status ws on ws.id = w.status_id;
