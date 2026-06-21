begin;

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
delete from public.boh_user_app bua
using ids
where bua.app_id = ids.cafe_id
  and exists (
    select 1
    from public.boh_user_app existing
    where existing.user_id = bua.user_id
      and existing.app_id = ids.studio_id
  );

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.boh_user_app bua
set app_id = ids.studio_id,
    app_context = 'boh'
from ids
where bua.app_id = ids.cafe_id;

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.boh_app_module m
set app_id = ids.studio_id,
    route = case when m.route like '/cafe/%' then regexp_replace(m.route, '^/cafe', '/studio') else m.route end,
    group_label = case when lower(coalesce(m.group_label, '')) = 'cafe' then 'Studio' else m.group_label end,
    surface = 'external'
from ids
where m.app_id = ids.cafe_id;

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.boh_initiative i
set app_id = ids.studio_id
from ids
where i.app_id = ids.cafe_id;

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.counter_ticket t
set app_id = ids.studio_id,
    app = case when lower(coalesce(t.app, '')) = 'cafe' then 'studio' else t.app end,
    app_context = case when lower(coalesce(t.app_context, '')) = 'cafe' then 'studio' else t.app_context end
from ids
where t.app_id = ids.cafe_id
   or lower(coalesce(t.app, '')) = 'cafe'
   or lower(coalesce(t.app_context, '')) = 'cafe';

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.central_task t
set app_id = ids.studio_id
from ids
where t.app_id = ids.cafe_id;

with ids as (
  select
    (select id from public.boh_app where slug = 'cafe' limit 1) as cafe_id,
    (select id from public.boh_app where slug = 'studio' limit 1) as studio_id
)
update public.central_lessons_learned l
set app_id = ids.studio_id
from ids
where l.app_id = ids.cafe_id;

update public.boh_app
set is_active = false,
    offering_status = 'retired',
    description = 'Retired duplicate record. Cafe product offering is managed under Studio.'
where slug = 'cafe';

update public.boh_app
set name = 'Studio',
    slug = 'studio',
    surface = 'external',
    location = 'External',
    type = 'external_app',
    external_url = 'https://app.jobzcafe.com',
    route = null,
    is_active = true,
    offering_status = 'active'
where slug = 'studio';

commit;

select a.slug, a.name, a.is_active, a.offering_status, count(m.id) as module_count
from public.boh_app a
left join public.boh_app_module m on m.app_id = a.id
where a.slug in ('cafe', 'studio')
group by a.slug, a.name, a.is_active, a.offering_status
order by a.slug;
