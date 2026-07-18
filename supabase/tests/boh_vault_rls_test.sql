-- pgTAP behavioral authorization/RLS tests for two tenants, two BOH users, and JWTs.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('public', 'boh_vault_current_user_id', array['uuid'], 'tenant-aware BOH identity resolver exists');
select has_function('public', 'boh_vault_has_role', array['uuid','text[]','text'], 'JWT role helper exists');
select has_function('public', 'boh_vault_user_has_role', array['uuid','uuid','text[]','text'], 'explicit actor helper exists');
select ok(position('status = ''active''' in lower(pg_get_functiondef('public.boh_vault_current_user_id(uuid)'::regprocedure))) > 0
  and position('tenant_id = requested_tenant_id' in lower(pg_get_functiondef('public.boh_vault_current_user_id(uuid)'::regprocedure))) > 0,
  'identity resolver requires the requested tenant and an active BOH user');
select ok(position('super_admin' in lower(pg_get_functiondef('public.boh_vault_has_role(uuid,text[],text)'::regprocedure))) = 0
  and position('email' in lower(pg_get_functiondef('public.boh_vault_has_role(uuid,text[],text)'::regprocedure))) = 0,
  'authorization has no super-admin or email inference');
select ok(position('boh_tenant_app' in lower(pg_get_functiondef('public.boh_vault_user_has_role(uuid,uuid,text[],text)'::regprocedure))) > 0
  and position('tenant.status = ''active''' in lower(pg_get_functiondef('public.boh_vault_user_has_role(uuid,uuid,text[],text)'::regprocedure))) > 0
  and position('user_row.status = ''active''' in lower(pg_get_functiondef('public.boh_vault_user_has_role(uuid,uuid,text[],text)'::regprocedure))) > 0,
  'authorization requires active tenant, user, member, enabled app, and grant');
select ok(position('sync_operator' in pg_get_constraintdef((select oid from pg_constraint where conname = 'boh_vault_access_grants_role_check'))) > 0,
  'sync_operator is the synchronization role');
select ok(position('gateway_operator' in pg_get_constraintdef((select oid from pg_constraint where conname = 'boh_vault_access_grants_role_check'))) = 0,
  'gateway_operator is not a Vault role');

create temporary table _vault_rls_pairs as
select tenant.id tenant_id, user_row.id user_id, user_row.auth_user_id,
  row_number() over (order by tenant.id, user_row.id) rn
from public.boh_tenant tenant
join public.boh_user user_row
  on user_row.tenant_id = tenant.id
 and user_row.status = 'active'
 and user_row.app_context = 'boh'
 and user_row.auth_user_id is not null
join public.boh_tenant_member member
  on member.tenant_id = tenant.id
 and member.user_id = user_row.id
 and member.membership_status = 'active'
where tenant.status = 'active';
create temporary table _vault_rls_fixture as
select p1.tenant_id tenant_one, p2.tenant_id tenant_two,
  p1.user_id user_one, p1.auth_user_id auth_one,
  p2.user_id user_two, p2.auth_user_id auth_two,
  gen_random_uuid() item_one, gen_random_uuid() item_two, gen_random_uuid() item_prod
from _vault_rls_pairs p1
join _vault_rls_pairs p2 on p1.rn = 1 and p2.rn > p1.rn
where p2.tenant_id <> p1.tenant_id
order by p2.rn
limit 1;
select ok((select count(*) = 1 from _vault_rls_fixture), 'two canonical active tenant/user/member pairs are available');

insert into public.boh_tenant_member(tenant_id, user_id, membership_status)
select tenant_one, user_one, 'active' from _vault_rls_fixture
union all select tenant_two, user_two, 'active' from _vault_rls_fixture
on conflict (tenant_id, user_id) do update set membership_status = 'active';

insert into public.boh_tenant_app(tenant_id, app_id, status, app_kind, display_name, launch_route)
select fixture.tenant_one, app.id, 'enabled', 'boh', 'Vault', '/vault'
from _vault_rls_fixture fixture join public.boh_app app on app.slug = 'vault'
union all
select fixture.tenant_two, app.id, 'enabled', 'boh', 'Vault', '/vault'
from _vault_rls_fixture fixture join public.boh_app app on app.slug = 'vault'
on conflict (tenant_id, app_id) do update set status = 'enabled';

delete from public.boh_vault_access_grants grant_row
using _vault_rls_fixture fixture
where (grant_row.tenant_id, grant_row.boh_user_id) in (
  (fixture.tenant_one, fixture.user_one), (fixture.tenant_two, fixture.user_two)
);
insert into public.boh_vault_access_grants(tenant_id, boh_user_id, role, environment, status, granted_by)
select tenant_one, user_one, 'vault_viewer', 'development', 'active', user_one from _vault_rls_fixture
union all
select tenant_two, user_two, 'vault_viewer', 'development', 'active', user_two from _vault_rls_fixture;

insert into public.boh_vault_items(id, tenant_id, item_key, display_name, environment, notes, created_by)
select item_one, tenant_one, 'pgtap-rls-tenant-one', 'Tenant one item', 'development', 'ordinary searchable note', user_one from _vault_rls_fixture
union all
select item_two, tenant_two, 'pgtap-rls-tenant-two', 'Tenant two item', 'development', 'ordinary searchable note', user_two from _vault_rls_fixture
union all
select item_prod, tenant_one, 'pgtap-rls-prod', 'Tenant one production item', 'production', null, user_one from _vault_rls_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 1::bigint,
  'user one JWT can read its granted tenant/environment');
select is((select count(*) from public.boh_vault_items_safe where id = (select item_two from _vault_rls_fixture)), 0::bigint,
  'user one JWT cannot cross into tenant two');
select is((select count(*) from public.boh_vault_items_safe where id = (select item_prod from _vault_rls_fixture)), 0::bigint,
  'development grant cannot read production');
select throws_ok($$insert into public.boh_vault_items(tenant_id,item_key,display_name,environment)
  select tenant_one,'browser-write','Browser write','development' from _vault_rls_fixture$$,
  '42501', null, 'browser write is denied');
select throws_ok($$select count(*) from public.boh_vault_secret_versions$$,
  '42501', null, 'browser protected-table read is denied');

select set_config('request.jwt.claim.sub', (select auth_two::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_two from _vault_rls_fixture)), 1::bigint,
  'user two JWT can read tenant two');
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'user two JWT cannot cross into tenant one');
reset role;

update public.boh_vault_access_grants set status = 'suspended'
where tenant_id = (select tenant_one from _vault_rls_fixture) and boh_user_id = (select user_one from _vault_rls_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'suspended grant denies access');
reset role;

update public.boh_vault_access_grants set status = 'active', created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
where tenant_id = (select tenant_one from _vault_rls_fixture) and boh_user_id = (select user_one from _vault_rls_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'expired active-status grant still denies access');
reset role;

update public.boh_vault_access_grants set expires_at = null
where tenant_id = (select tenant_one from _vault_rls_fixture) and boh_user_id = (select user_one from _vault_rls_fixture);
update public.boh_tenant_member set membership_status = 'inactive'
where tenant_id = (select tenant_one from _vault_rls_fixture) and user_id = (select user_one from _vault_rls_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'inactive tenant membership denies access');
reset role;

update public.boh_tenant_member set membership_status = 'active'
where tenant_id = (select tenant_one from _vault_rls_fixture) and user_id = (select user_one from _vault_rls_fixture);
update public.boh_tenant_app set status = 'disabled'
where tenant_id = (select tenant_one from _vault_rls_fixture)
  and app_id = (select id from public.boh_app where slug = 'vault');
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'disabled tenant Vault app denies access');
reset role;

update public.boh_tenant_app set status = 'enabled'
where tenant_id = (select tenant_one from _vault_rls_fixture)
  and app_id = (select id from public.boh_app where slug = 'vault');
update public.boh_tenant set status = 'suspended' where id = (select tenant_one from _vault_rls_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'suspended tenant denies access');
reset role;

update public.boh_tenant set status = 'active' where id = (select tenant_one from _vault_rls_fixture);
update public.boh_user set status = 'inactive' where id = (select user_one from _vault_rls_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select auth_one::text from _vault_rls_fixture), true);
select is((select count(*) from public.boh_vault_items_safe where id = (select item_one from _vault_rls_fixture)), 0::bigint,
  'inactive BOH user denies access');
reset role;

select ok((select relrowsecurity from pg_class where oid = 'public.boh_vault_secret_versions'::regclass), 'secret-version RLS is enabled');
select ok(not exists (
  select 1 from pg_policies where schemaname = 'public' and tablename like 'boh_vault_%'
    and cmd in ('INSERT','UPDATE','DELETE','ALL') and roles @> array['authenticated']::name[]
), 'authenticated browser has no Vault write policy');

select * from finish();
rollback;
