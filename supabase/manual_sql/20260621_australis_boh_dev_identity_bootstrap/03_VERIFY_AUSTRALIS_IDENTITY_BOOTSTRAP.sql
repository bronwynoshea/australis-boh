-- BOH-DEV only: verify Australis identity + Patron bootstrap.
-- Run after 02_BOOTSTRAP_AUSTRALIS_BOH_DEV_IDENTITIES.sql.
-- Do not run in production.

-- 1. Auth users. Both rows should appear if both BOH-DEV identities were created/invited.
select
  lower(email) as email,
  id as auth_user_id,
  confirmed_at,
  last_sign_in_at,
  created_at
from auth.users
where lower(email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(email);

-- 2. BOH user rows. auth_user_id must be non-null and match auth.users.id.
select
  lower(u.email) as email,
  u.id as boh_user_id,
  u.auth_user_id,
  au.id is not null as auth_user_exists,
  u.status,
  u.primary_role_hint,
  t.slug as primary_tenant_slug,
  u.app_context,
  case
    when au.id is null then 'MISSING_AUTH_LINK'
    when t.slug <> 'australis' then 'CHECK_PRIMARY_TENANT'
    when u.status <> 'active' then 'CHECK_STATUS'
    else 'OK'
  end as check_result
from public.boh_user u
left join auth.users au on au.id = u.auth_user_id
left join public.boh_tenant t on t.id = u.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email);

-- 3. Australis membership. Both BOH-DEV users should be active members when both Auth users exist.
select
  lower(u.email) as email,
  tm.membership_status,
  tm.is_default,
  t.slug as tenant_slug,
  case when tm.membership_status = 'active' then 'OK' else 'CHECK_MEMBERSHIP' end as check_result
from public.boh_tenant_member tm
join public.boh_tenant t on t.id = tm.tenant_id
join public.boh_user u on u.id = tm.user_id
where t.slug = 'australis'
  and lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email);

-- 4. Role assignments. Admin should have admin/super_admin-capable role if available; hello should have staff/default role.
select
  lower(u.email) as email,
  r.code as role_code,
  r.name as role_name,
  t.slug as tenant_slug,
  ur.app_context
from public.boh_user_role ur
join public.boh_user u on u.id = ur.user_id
join public.boh_role r on r.id = ur.role_id
left join public.boh_tenant t on t.id = ur.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
  and (t.slug = 'australis' or ur.tenant_id is null)
order by lower(u.email), r.code;

-- 5. Australis tenant app enablement. Expected enabled app slugs: menu, forge, counter, patron when those apps exist.
select
  a.slug as app_slug,
  a.name as app_name,
  ta.status,
  ta.app_kind,
  ta.metadata,
  case when ta.status = 'enabled' then 'OK' else 'CHECK_TENANT_APP' end as check_result
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'australis'
  and a.slug in ('menu', 'forge', 'counter', 'patron')
order by a.slug;

-- 6. User app grants. Expected:
--    admin@australis.cloud: menu, forge, counter, patron.
--    hello@australis.cloud: menu, counter, patron for BOH-DEV normal-user smoke testing.
select
  lower(u.email) as email,
  a.slug as app_slug,
  ua.permission_level,
  t.slug as tenant_slug,
  ua.app_context
from public.boh_user_app ua
join public.boh_user u on u.id = ua.user_id
join public.boh_app a on a.id = ua.app_id
left join public.boh_tenant t on t.id = ua.tenant_id
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
  and a.slug in ('menu', 'forge', 'counter', 'patron')
  and (t.slug = 'australis' or ua.tenant_id is null)
order by lower(u.email), a.slug;

-- 7. Patron organisation/person records.
select
  'organisation' as record_type,
  o.id,
  o.name,
  o.website,
  null::text as email,
  null::uuid as boh_user_id,
  t.slug as tenant_slug,
  o.status,
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
  p.boh_user_id,
  t.slug as tenant_slug,
  null::text as status,
  p.created_at,
  p.updated_at
from public.patron_person p
left join public.boh_tenant t on t.id = p.tenant_id
where lower(p.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by record_type, email nulls first;

-- 8. Patron person -> organisation links, if the link table exists.
select
  lower(p.email) as email,
  o.name as organisation_name,
  p.boh_user_id,
  pt.slug as person_tenant_slug,
  ot.slug as organisation_tenant_slug
from public.patron_person_organisation po
join public.patron_person p on p.id = po.person_id
join public.patron_organisation o on o.id = po.organisation_id
left join public.boh_tenant pt on pt.id = p.tenant_id
left join public.boh_tenant ot on ot.id = o.tenant_id
where lower(p.email) in ('admin@australis.cloud', 'hello@australis.cloud')
  and lower(o.name) = 'australis'
order by lower(p.email);

-- 9. Compact missing-record checklist.
with expected(email) as (
  values ('admin@australis.cloud'::text), ('hello@australis.cloud'::text)
), auth_check as (
  select lower(email) as email, id from auth.users where lower(email) in (select email from expected)
), boh_check as (
  select lower(email) as email, id, auth_user_id from public.boh_user where lower(email) in (select email from expected) and app_context = 'boh'
), member_check as (
  select lower(u.email) as email
  from public.boh_tenant_member tm
  join public.boh_tenant t on t.id = tm.tenant_id
  join public.boh_user u on u.id = tm.user_id
  where t.slug = 'australis' and tm.membership_status = 'active'
), patron_check as (
  select lower(email) as email from public.patron_person where lower(email) in (select email from expected)
)
select
  e.email,
  (a.id is not null) as has_auth_user,
  (b.id is not null) as has_boh_user,
  (b.auth_user_id = a.id and a.id is not null) as auth_link_matches,
  (m.email is not null) as has_active_australis_membership,
  (p.email is not null) as has_patron_person,
  case
    when a.id is null then 'CREATE_OR_INVITE_AUTH_USER_IN_BOH_DEV'
    when b.id is null then 'RERUN_BOOTSTRAP_TO_CREATE_BOH_USER'
    when b.auth_user_id is distinct from a.id then 'FIX_AUTH_USER_ID_LINK'
    when m.email is null then 'RERUN_BOOTSTRAP_TO_CREATE_MEMBERSHIP'
    when p.email is null then 'RERUN_BOOTSTRAP_TO_CREATE_PATRON_PERSON'
    else 'OK'
  end as next_action
from expected e
left join auth_check a on a.email = e.email
left join boh_check b on b.email = e.email
left join member_check m on m.email = e.email
left join patron_check p on p.email = e.email
order by e.email;
