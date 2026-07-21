const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const q = (sql) => db.query(sql);
const exec = (sql) => db.exec(sql);
async function rejects(sql, pattern) {
  let error;
  try { await exec(sql); } catch (candidate) { error = candidate; }
  assert(error, `expected rejection: ${sql}`);
  if (pattern) assert.match(String(error), pattern);
}

const ids = {
  tenant1: '10000000-0000-0000-0000-000000000001',
  tenant2: '10000000-0000-0000-0000-000000000002',
  auth1: '20000000-0000-0000-0000-000000000001',
  auth2: '20000000-0000-0000-0000-000000000002',
  auth3: '20000000-0000-0000-0000-000000000003',
  user1: '30000000-0000-0000-0000-000000000001',
  user2: '30000000-0000-0000-0000-000000000002',
  user3: '30000000-0000-0000-0000-000000000003',
  role: '40000000-0000-0000-0000-000000000001',
  credential: '50000000-0000-0000-0000-000000000001',
  password: '50000000-0000-0000-0000-000000000002',
};

await exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create schema private;
  create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.boh_tenant(id uuid primary key,slug text unique not null,name text,status text not null);
  create table public.boh_user(id uuid primary key,auth_user_id uuid,tenant_id uuid references public.boh_tenant(id),app_context text,status text);
  create table public.boh_tenant_member(tenant_id uuid references public.boh_tenant(id),user_id uuid references public.boh_user(id),membership_status text,primary key(tenant_id,user_id));
  create table public.boh_app(id uuid primary key,name text,slug text unique,description text,route text,external_url text,primary_color text,type text,is_active boolean,app_context text,created_at timestamptz);
  create table public.boh_tenant_app(id uuid default gen_random_uuid() primary key,tenant_id uuid references public.boh_tenant(id),app_id uuid references public.boh_app(id),status text,app_kind text,unique(tenant_id,app_id));
  create table public.boh_role(id uuid primary key,code text unique not null);
  create table public.boh_user_role(user_id uuid references public.boh_user(id),tenant_id uuid references public.boh_tenant(id),role_id uuid references public.boh_role(id),app_context text,primary key(user_id,tenant_id,role_id));
  create table public.boh_user_app(id uuid default gen_random_uuid() primary key,user_id uuid references public.boh_user(id),tenant_id uuid references public.boh_tenant(id),app_id uuid references public.boh_app(id),app_context text,permission_level text,unique(user_id,tenant_id,app_id));
  create table public.boh_vault_items(id uuid primary key,tenant_id uuid not null references public.boh_tenant(id),item_type text not null,environment text not null,value_state text not null default 'needs_setup',unique(tenant_id,id));
  create function public.boh_vault_user_can_access_item(uuid,uuid,uuid,text,text default 'read') returns boolean language sql stable as $$select $3='${ids.user1}'::uuid$$;
  insert into auth.users values('${ids.auth1}','one@example.test'),('${ids.auth2}','two@example.test'),('${ids.auth3}','three@example.test');
  insert into boh_tenant values('${ids.tenant1}','one','One','active'),('${ids.tenant2}','two','Two','active');
  insert into boh_user values('${ids.user1}','${ids.auth1}','${ids.tenant1}','boh','active'),('${ids.user2}','${ids.auth2}','${ids.tenant2}','boh','active'),('${ids.user3}','${ids.auth3}','${ids.tenant1}','boh','active');
  insert into boh_tenant_member values('${ids.tenant1}','${ids.user1}','active'),('${ids.tenant2}','${ids.user2}','active'),('${ids.tenant1}','${ids.user3}','active');
  insert into boh_role values('${ids.role}','super_admin');
  insert into boh_user_role values('${ids.user1}','${ids.tenant1}','${ids.role}','boh');
  insert into boh_vault_items(id,tenant_id,item_type,environment) values('${ids.credential}','${ids.tenant1}','credential','development'),('${ids.password}','${ids.tenant1}','login','development');
`);

await exec(await readFile(new URL('../migrations/20260721130000_create_boh_switchboard_foundation.sql', import.meta.url), 'utf8'));
await exec(await readFile(new URL('../migrations/20260721132000_enable_switchboard_for_vault_tenants.sql', import.meta.url), 'utf8'));
await exec(await readFile(new URL('../migrations/20260721134000_enforce_switchboard_provider_resource_kinds.sql', import.meta.url), 'utf8'));

await exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ids.auth1}',false)`);
let result = await q(`select boh_switchboard_has_access('${ids.tenant1}') allowed`);
assert.equal(result.rows[0].allowed, false, 'registered app is not an automatic tenant entitlement');
await rejects(`select boh_switchboard_create_project('${ids.tenant1}','jobzcafe','JOBZCAFE',null,'project-before-entitlement')`, /access is required/i);
await exec('reset role');

await exec(`
  insert into boh_tenant_app(tenant_id,app_id,status,app_kind)
  select '${ids.tenant1}',id,'enabled','boh' from boh_app where slug='switchboard';
  insert into boh_user_app(user_id,tenant_id,app_id,app_context,permission_level)
  select '${ids.user3}','${ids.tenant1}',id,'boh','edit' from boh_app where slug='switchboard';
`);
await exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ids.auth1}',false)`);
result = await q(`select boh_switchboard_has_access('${ids.tenant1}') allowed,boh_switchboard_has_access('${ids.tenant2}') cross`);
assert.deepEqual(result.rows[0], { allowed: true, cross: false });
result = await q(`select boh_switchboard_permission_level('${ids.tenant1}') permission`);
assert.equal(result.rows[0].permission, 'admin');

result = await q(`select boh_switchboard_create_project('${ids.tenant1}','jobzcafe','JOBZCAFE', 'JOBZCAFE product services','create-jobzcafe') id`);
const projectId = result.rows[0].id;
assert(projectId);
result = await q(`select environment from boh_switchboard_project_environments where project_id='${projectId}' order by environment`);
assert.deepEqual(result.rows, [{ environment: 'development' }, { environment: 'production' }]);
await rejects(`insert into boh_switchboard_projects(tenant_id,project_key,name,created_by,updated_by) values('${ids.tenant1}','direct','Direct','${ids.user1}','${ids.user1}')`, /permission denied/i);

result = await q(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','github-jobzcafe','github','JOBZCAFE GitHub','bronwynoshea','bronwynoshea',
  '${ids.credential}','development','repository','JOBZCAFE repository','bronwynoshea/jobzcafe-app',
  'https://github.com/bronwynoshea/jobzcafe-app','link-github-jobzcafe'
) id`);
const resourceId = result.rows[0].id;
assert(resourceId);
result = await q(`select provider,environment_scope,status,credential_vault_item_id from boh_switchboard_connections where connection_key='github-jobzcafe'`);
assert.deepEqual(result.rows[0], { provider: 'github', environment_scope: 'development', status: 'connected', credential_vault_item_id: ids.credential });
result = await q(`select project_id,environment_scope,resource_kind,external_resource_id from boh_switchboard_resources where id='${resourceId}'`);
assert.deepEqual(result.rows[0], { project_id: projectId, environment_scope: 'development', resource_kind: 'repository', external_resource_id: 'bronwynoshea/jobzcafe-app' });

await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','github-invalid-kind','github','GitHub invalid kind',null,null,
  null,'development','pages_project','Invalid Pages project','invalid-pages','https://invalid-pages.example.test','reject-provider-resource-kind'
)`, /Resource type is not valid for the selected provider/i);

await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','github-shared','github','GitHub shared',null,null,
  '${ids.credential}','shared','repository','Shared repository','bronwynoshea/shared','https://github.com/bronwynoshea/shared','reject-shared-credential'
)`, /Shared resources cannot use an exact-environment/i);
await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','github-jobzcafe','cloudflare','Repurposed connection',null,null,
  null,'development','pages_project','Bad Pages project','bad-pages','https://bad-pages.pages.dev','reject-provider-repurpose'
)`, /already assigned to another provider/i);

await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','password-auth','github','Bad password connection',null,null,
  '${ids.password}','shared','repository','Bad repository','bad/repository','https://github.com/bad/repository','reject-password'
)`, /Password items cannot authorize/i);
await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','http-resource','cloudflare','Cloudflare',null,null,
  null,'production','pages_project','JOBZCAFE Pages','jobzcafe','http://pages.example.test','reject-http'
)`, /Service URL must use HTTPS/i);
await rejects(`select boh_switchboard_create_project('${ids.tenant2}','cross','Cross tenant',null,'cross-tenant')`, /access is required/i);

await exec(`select set_config('request.jwt.claim.sub','${ids.auth3}',false)`);
result = await q(`select boh_switchboard_permission_level('${ids.tenant1}') permission`);
assert.equal(result.rows[0].permission, 'edit');
await rejects(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','unauthorized-vault','github','Unauthorized Vault',null,null,
  '${ids.credential}','development','repository','Unauthorized repository','unauthorized/repository','https://github.com/unauthorized/repository','reject-vault-access'
)`, /Vault credential access is required/i);
await exec(`select set_config('request.jwt.claim.sub','${ids.auth1}',false)`);

result = await q(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${projectId}','cloudflare-jobzcafe','cloudflare','JOBZCAFE Cloudflare',null,null,
  null,'production','pages_project','JOBZCAFE Pages','jobzcafe','https://jobzcafe.pages.dev','link-cloudflare-jobzcafe'
) id`);
const targetResourceId = result.rows[0].id;
result = await q(`select boh_switchboard_create_project('${ids.tenant1}','other-project','Other project',null,'create-other-project') id`);
const otherProjectId = result.rows[0].id;
result = await q(`select boh_switchboard_link_resource(
  '${ids.tenant1}','${otherProjectId}','cloudflare-other','cloudflare','Other Cloudflare',null,null,
  null,'production','pages_project','Other Pages','other-pages','https://other-pages.pages.dev','link-cloudflare-other'
) id`);
const otherTargetResourceId = result.rows[0].id;
await exec('reset role');
result = await q(`select id,environment from boh_switchboard_project_environments where project_id='${projectId}'`);
const developmentEnvironmentId = result.rows.find((row)=>row.environment==='development').id;
const productionEnvironmentId = result.rows.find((row)=>row.environment==='production').id;
await q(`insert into boh_switchboard_builds(tenant_id,project_environment_id,source_resource_id,provider,external_build_id,status)
  values('${ids.tenant1}','${developmentEnvironmentId}','${resourceId}','github','build-1','succeeded') returning id`);
await rejects(`insert into boh_switchboard_builds(tenant_id,project_environment_id,source_resource_id,provider,external_build_id,status)
  values('${ids.tenant1}','${developmentEnvironmentId}','${resourceId}','cloudflare','bad-provider-build','succeeded')`, /provider must match/i);
await rejects(`insert into boh_switchboard_deployments(tenant_id,project_environment_id,target_resource_id,provider,external_deployment_id,status,is_current)
  values('${ids.tenant1}','${productionEnvironmentId}','${otherTargetResourceId}','cloudflare','cross-project-deployment','succeeded',false)`, /must belong to the project/i);
await q(`insert into boh_switchboard_deployments(tenant_id,project_environment_id,target_resource_id,provider,external_deployment_id,status,is_current)
  values('${ids.tenant1}','${productionEnvironmentId}','${targetResourceId}','cloudflare','deployment-1','succeeded',true) returning id`);
await rejects(`insert into boh_switchboard_deployments(tenant_id,project_environment_id,target_resource_id,provider,external_deployment_id,status,is_current)
  values('${ids.tenant1}','${productionEnvironmentId}','${targetResourceId}','cloudflare','deployment-2','succeeded',true)`, /unique|duplicate/i);
await exec(`set role authenticated;select set_config('request.jwt.claim.sub','${ids.auth1}',false)`);

result = await q(`select event_type,project_id,resource_id from boh_switchboard_audit_events order by created_at,event_type`);
assert.deepEqual(result.rows.map((row) => row.event_type).sort(), ['project_created', 'project_created', 'resource_linked', 'resource_linked', 'resource_linked']);
assert(result.rows.some((row) => row.project_id === projectId && row.resource_id === resourceId));
await exec('reset role');
await rejects(`update boh_switchboard_audit_events set summary='changed' where resource_id='${resourceId}'`, /append-only/i);

await exec(`set role service_role`);
result = await q(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'boh_switchboard_%' and has_function_privilege('service_role',p.oid,'execute') order by proname`);
assert.deepEqual(result.rows, [], 'service_role receives no implicit Switchboard mutation surface');
await exec('reset role');

console.log('BOH Switchboard PGlite behavioral checks passed');
