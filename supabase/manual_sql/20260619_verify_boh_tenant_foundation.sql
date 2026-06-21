-- Verification for 20260619_add_boh_tenant_foundation.sql
-- Run after applying the migration to BOH-DEV. This file is read-only.

-- 1. Tenant foundation exists and JOBZCAFE® is the first/default tenant.
select
  slug,
  name,
  status,
  app_context,
  metadata ->> 'default_tenant' as default_tenant
from public.boh_tenant
where slug = 'jobzcafe';

-- 2. BOH identity/access tables are tenant-scoped and backfilled.
select 'boh_user' as table_name, count(*) filter (where tenant_id is null) as missing_tenant_id from public.boh_user
union all
select 'boh_user_role', count(*) filter (where tenant_id is null) from public.boh_user_role
union all
select 'boh_user_app', count(*) filter (where tenant_id is null) from public.boh_user_app;

-- 3. JOBZCAFE tenant has app enablement records; Central should not be enabled
-- as a BOH Suite app because that product direction is now Australis.
select
  a.slug,
  coalesce(ta.display_name, a.name) as display_name,
  ta.status,
  ta.app_kind,
  ta.launch_route,
  ta.external_url
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'jobzcafe'
order by ta.app_kind, a.slug;

-- 4. New BOH Suite modules are present but marked coming_soon for JOBZCAFE.
select
  a.slug,
  coalesce(ta.display_name, a.name) as display_name,
  ta.status,
  ta.app_kind
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'jobzcafe'
  and a.slug in ('assembly', 'funnel', 'wiki')
order by a.slug;

-- 5. Expected BOH Suite/external classification snapshot.
select
  ta.app_kind,
  array_agg(a.slug order by a.slug) as app_slugs
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'jobzcafe'
group by ta.app_kind
order by ta.app_kind;

-- 5b. There should be no hybrid app kind: apps are either BOH modules or
-- external JOBZCAFE dashboard-launch apps.
select count(*) as non_boh_or_external_app_kind_count
from public.boh_tenant_app
where app_kind not in ('boh', 'external');

-- 6. Spot-check operational tenant_id columns that should exist if those tables exist.
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name = 'tenant_id'
  and table_name in (
    'boh_initiative', 'boh_workstream', 'boh_user_story', 'boh_task',
    'counter_ticket', 'counter_ticket_comment',
    'tablez_project', 'tablez_task', 'tablez_chair',
    'keep_file', 'keep_folder', 'content_projects',
    'patron_person', 'patron_organisation', 'patron_activity',
    'scheduling_bookings', 'google_oauth_tokens', 'outlook_oauth_tokens',
    'cellar_presentations', 'cellar_investor_profiles'
  )
order by table_name;

-- 7. Full BOH app table audit. This intentionally excludes:
-- - central_* tables, which move with Australis work later;
-- - boh_secret, which is deprecated and should be removed after scheduling triggers stop using it;
-- - app/role/tenant registry tables whose tenant mapping is handled by boh_tenant_app/boh_tenant_member.
with tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
), cols as (
  select table_name, bool_or(column_name = 'tenant_id') as has_tenant_id
  from information_schema.columns
  where table_schema = 'public'
  group by table_name
)
select t.table_name
from tables t
left join cols c using (table_name)
where t.table_name !~ '^(auth_|storage_|supabase_)'
  and t.table_name not like 'central_%'
  and t.table_name not in ('boh_secret', 'boh_app', 'boh_app_module', 'boh_role', 'boh_tenant')
  and coalesce(c.has_tenant_id, false) = false
order by t.table_name;
