-- BOH-DEV only: Australis identity/auth precheck.
-- Run in the BOH-DEV Supabase SQL editor before bootstrap.
-- Do not run in production.

-- 1. Confirm the tenant exists and is separate from JOBZCAFE®.
select
  slug,
  name,
  legal_name,
  status,
  app_context,
  metadata,
  id as tenant_id
from public.boh_tenant
where slug in ('australis', 'jobzcafe')
order by slug;

-- 2. Human/Auth Admin check: these rows must exist before BOH bootstrap can link auth_user_id.
select
  lower(email) as email,
  id as auth_user_id,
  confirmed_at,
  last_sign_in_at,
  created_at
from auth.users
where lower(email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(email);

-- 3. Current BOH user links. auth_user_id must be populated; email-only matching is not enough.
select
  u.id as boh_user_id,
  lower(u.email) as email,
  u.auth_user_id,
  u.status,
  u.primary_role_hint,
  u.tenant_id,
  t.slug as primary_tenant_slug,
  u.app_context,
  u.created_at,
  u.updated_at
from public.boh_user u
left join public.boh_tenant t on t.id = u.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email);

-- 4. Current Australis tenant membership.
select
  lower(u.email) as email,
  tm.membership_status,
  tm.is_default,
  tm.created_at,
  tm.updated_at
from public.boh_tenant_member tm
join public.boh_tenant t on t.id = tm.tenant_id
join public.boh_user u on u.id = tm.user_id
where t.slug = 'australis'
  and lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email);

-- 5. Current role assignments.
select
  lower(u.email) as email,
  r.code as role_code,
  r.name as role_name,
  ur.tenant_id,
  t.slug as tenant_slug,
  ur.app_context
from public.boh_user_role ur
join public.boh_user u on u.id = ur.user_id
join public.boh_role r on r.id = ur.role_id
left join public.boh_tenant t on t.id = ur.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email), r.code;

-- 6. Tenant-level app enablement for Australis.
select
  a.slug as app_slug,
  a.name as app_name,
  ta.status,
  ta.app_kind,
  ta.display_name,
  ta.metadata
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'australis'
order by a.slug;

-- 7. User app grants for target users.
select
  lower(u.email) as email,
  a.slug as app_slug,
  a.name as app_name,
  ua.permission_level,
  ua.tenant_id,
  t.slug as tenant_slug,
  ua.app_context
from public.boh_user_app ua
join public.boh_user u on u.id = ua.user_id
join public.boh_app a on a.id = ua.app_id
left join public.boh_tenant t on t.id = ua.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email), a.slug;

-- 8. Patron state for Australis visibility.
select
  'organisation' as record_type,
  o.id,
  o.name,
  o.website,
  null::text as email,
  o.tenant_id,
  t.slug as tenant_slug,
  o.created_at,
  o.updated_at
from public.patron_organisation o
left join public.boh_tenant t on t.id = o.tenant_id
where lower(o.name) = 'australis'
union all
select
  'person' as record_type,
  p.id,
  trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as name,
  null::text as website,
  lower(p.email) as email,
  p.tenant_id,
  t.slug as tenant_slug,
  p.created_at,
  p.updated_at
from public.patron_person p
left join public.boh_tenant t on t.id = p.tenant_id
where lower(p.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by record_type, email nulls first;
