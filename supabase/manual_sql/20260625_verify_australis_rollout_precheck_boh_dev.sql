-- BOH-DEV only: focused verification before Australis rollout seed.
select 'tenant' as check_type, slug as key, name as value, status::text as status
from public.boh_tenant
where slug = 'australis';

select 'boh_user' as check_type, lower(email) as key, coalesce(status::text, 'unknown') as value, id::text as status
from public.boh_user
where lower(email) in ('admin@australis.cloud', 'hello@australis.cloud', 'jobzcafe.ai@gmail.com')
order by lower(email);

select 'app' as check_type, slug as key, name as value, coalesce(is_active::text, 'unknown') as status
from public.boh_app
where slug in ('menu', 'forge', 'counter', 'patron')
order by slug;

select 'initiative' as check_type, title as key, status::text as value, id::text as status
from public.boh_initiative
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and title in ('Build standalone Australis platform', 'Bootstrap Australis autonomous business foundation')
order by title;
