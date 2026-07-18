const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const q = (sql, params=[]) => db.query(sql, params);
const exec = sql => db.exec(sql);
async function rejects(sql, pattern) {
  let error; try { await exec(sql); } catch (e) { error=e; }
  assert(error, `expected rejection: ${sql}`);
  if (pattern) assert.match(String(error), pattern);
}
const ids = {
 t1:'10000000-0000-0000-0000-000000000001', t2:'10000000-0000-0000-0000-000000000002',
 a1:'20000000-0000-0000-0000-000000000001', a2:'20000000-0000-0000-0000-000000000002',
 u1:'30000000-0000-0000-0000-000000000001', u2:'30000000-0000-0000-0000-000000000002',
 i1:'40000000-0000-0000-0000-000000000001', i2:'40000000-0000-0000-0000-000000000002',
 fp:'50000000-0000-0000-0000-000000000001', fs:'50000000-0000-0000-0000-000000000002', f2:'50000000-0000-0000-0000-000000000003', fr:'50000000-0000-0000-0000-000000000004',
 k1:'60000000-0000-0000-0000-000000000001'
};
await exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create table public.boh_tenant(id uuid primary key,slug text unique not null,name text not null,status text not null,app_context text,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.boh_user(id uuid primary key,auth_user_id uuid,tenant_id uuid references public.boh_tenant(id),app_context text,status text,created_at timestamptz default now());
 create table public.boh_tenant_member(id uuid default gen_random_uuid(),tenant_id uuid references public.boh_tenant(id),user_id uuid references public.boh_user(id),membership_status text,is_default boolean default false,created_at timestamptz default now(),updated_at timestamptz default now(),unique(tenant_id,user_id));
 create table public.boh_app(id uuid primary key,name text,slug text unique,description text,route text,external_url text,primary_color text,type text,is_active boolean,app_context text,created_at timestamptz);
 create table public.boh_tenant_app(id uuid default gen_random_uuid(),tenant_id uuid references public.boh_tenant(id),app_id uuid references public.boh_app(id),status text,app_kind text,display_name text,launch_route text,external_url text,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),unique(tenant_id,app_id));
`);
for (const name of ['20260715090000_create_boh_vault_core.sql','20260715091000_create_boh_vault_sync_targets.sql','20260715092000_register_boh_vault_app.sql','20260715093000_prepare_boh_vault_legacy_bridge.sql','20260715094000_create_boh_vault_secret_api.sql','20260715095000_create_boh_vault_sync_api.sql','20260715096000_create_boh_vault_ui_safe_views.sql','20260715097000_create_boh_vault_active_sync_request.sql','20260715103000_archive_boh_vault_items.sql'])
  await exec(await readFile(new URL(`../migrations/${name}`, import.meta.url),'utf8'));

await exec(`
 insert into auth.users values('${ids.a1}','one@example.test'),('${ids.a2}','two@example.test');
 insert into boh_tenant(id,slug,name,status) values('${ids.t1}','one','One','active'),('${ids.t2}','two','Two','active');
 insert into boh_user(id,auth_user_id,tenant_id,app_context,status) values('${ids.u1}','${ids.a1}','${ids.t1}','boh','active'),('${ids.u2}','${ids.a2}','${ids.t2}','boh','active');
 insert into boh_tenant_member(tenant_id,user_id,membership_status) values('${ids.t1}','${ids.u1}','active'),('${ids.t2}','${ids.u2}','active');
 insert into boh_tenant_app(tenant_id,app_id,status,app_kind) select '${ids.t1}',id,'enabled','boh' from boh_app where slug='vault';
 insert into boh_tenant_app(tenant_id,app_id,status,app_kind) select '${ids.t2}',id,'enabled','boh' from boh_app where slug='vault';
 insert into boh_vault_access_grants(tenant_id,boh_user_id,role,environment,status,granted_by,created_at,updated_at) values('${ids.t1}','${ids.u1}','vault_admin','development','active','${ids.u1}',now()-interval '2 minutes',now()),('${ids.t2}','${ids.u2}','vault_admin','development','active','${ids.u2}',now()-interval '2 minutes',now());
 insert into boh_vault_items(id,tenant_id,item_key,display_name,environment,created_by) values('${ids.i1}','${ids.t1}','one','One','development','${ids.u1}'),('${ids.i2}','${ids.t2}','two','Two','development','${ids.u2}');
 insert into boh_vault_item_fields(id,tenant_id,vault_item_id,field_key,label,field_kind,plaintext_value) values('${ids.fp}','${ids.t1}','${ids.i1}','url','URL','plaintext','https://safe.test'),('${ids.fs}','${ids.t1}','${ids.i1}','value','Value','protected',null),('${ids.f2}','${ids.t2}','${ids.i2}','value','Value','protected',null);
 insert into boh_vault_tenant_keys(id,tenant_id,key_version,wrapping_key_ref,wrapped_key,algorithm,state,activated_at,created_by) values('${ids.k1}','${ids.t1}',1,'kms://one','wrapped','AES-256-GCM','active',now(),'${ids.u1}');
`);
let r;

// First-use key bootstrap is service-only, audited, and idempotent.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select * from boh_vault_initialize_tenant_key('${ids.t2}','${ids.u2}','development','env:BOH_VAULT_MASTER_KEY_V1','v1.bootstrap.ciphertext','test-service','tenant-key-init-t2')`);
const initializedTenantKey=r.rows[0].tenant_key_id;
r=await q(`select * from boh_vault_initialize_tenant_key('${ids.t2}','${ids.u2}','development','env:BOH_VAULT_MASTER_KEY_V1','v1.ignored.concurrent','test-service','tenant-key-init-t2-retry')`);
assert.equal(r.rows[0].tenant_key_id,initializedTenantKey);
await exec(`reset role`);
r=await q(`select state,key_version from boh_vault_tenant_keys where id='${initializedTenantKey}'`); assert.deepEqual(r.rows[0],{state:'active',key_version:1});
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='tenant-key-init-t2' and event_type in ('tenant_key_created','tenant_key_activated')`); assert.equal(r.rows[0].n,2);
r=await q(`select count(*)::int n from boh_vault_tenant_keys where tenant_id='${ids.t2}'`); assert.equal(r.rows[0].n,1);

// Recursive JSON safety: nested, scalar, camelCase and obvious values.
for (const doc of [`'"ordinary scalar"'::jsonb`,`'{"notes":"ordinary deployment note","nested":[1,true,null]}'::jsonb`]) {
  const r=await q(`select boh_vault_json_has_protected_key(${doc}) unsafe`); assert.equal(r.rows[0].unsafe,false);
}
for (const doc of [`'{"nested":{"accessToken":"x"}}'::jsonb`,`'{"signingKey":"x"}'::jsonb`,`'{"authorization":"x"}'::jsonb`,`'{"credential":"x"}'::jsonb`,`'{"notes":"Bearer abcdefgh123456"}'::jsonb`]) {
  const r=await q(`select boh_vault_json_has_protected_key(${doc}) unsafe`); assert.equal(r.rows[0].unsafe,true,doc);
}
await rejects(`insert into boh_vault_access_grants(tenant_id,boh_user_id,role,status) values('${ids.t1}','${ids.u1}','gateway_operator','active')`,/check constraint/i);
await rejects(`insert into boh_vault_items(tenant_id,item_key,display_name,item_type,environment) values('${ids.t1}','note','note','secure_note','development')`,/check constraint/i);

// JWT/tenant behavior and safe CASE-protected plaintext contract.
await exec(`set role authenticated; select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok,boh_vault_has_role('${ids.t2}',array['vault_admin'],'development') cross`);
assert.deepEqual(r.rows[0],{ok:true,cross:false});
r=await q(`select field_kind,plaintext_value from boh_vault_item_fields_safe order by field_kind`);
assert.deepEqual(r.rows,[{field_kind:'plaintext',plaintext_value:'https://safe.test'},{field_kind:'protected',plaintext_value:null}]);
await exec(`reset role`);
for (const [mutate,restore] of [
 [`update boh_user set status='suspended' where id='${ids.u1}'`,`update boh_user set status='active' where id='${ids.u1}'`],
 [`update boh_tenant set status='suspended' where id='${ids.t1}'`,`update boh_tenant set status='active' where id='${ids.t1}'`],
 [`update boh_tenant_member set membership_status='inactive' where user_id='${ids.u1}'`,`update boh_tenant_member set membership_status='active' where user_id='${ids.u1}'`],
 [`update boh_tenant_app set status='disabled' where tenant_id='${ids.t1}'`,`update boh_tenant_app set status='enabled' where tenant_id='${ids.t1}'`],
 [`update boh_vault_access_grants set expires_at=now()-interval '1 minute' where boh_user_id='${ids.u1}'`,`update boh_vault_access_grants set expires_at=null where boh_user_id='${ids.u1}'`],
 [`update boh_vault_access_grants set status='revoked',revoked_by='${ids.u1}' where boh_user_id='${ids.u1}'`,`update boh_vault_access_grants set status='active',revoked_by=null where boh_user_id='${ids.u1}'`]
]) {
 await exec(mutate); await exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
 r=await q(`select boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok`); assert.equal(r.rows[0].ok,false,mutate);
 await exec(`reset role;${restore}`);
}
await exec(`update boh_vault_access_grants set environment='production' where boh_user_id='${ids.u1}'`);
r=await q(`select boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok`); assert.equal(r.rows[0].ok,false);
await exec(`update boh_vault_access_grants set environment='development' where boh_user_id='${ids.u1}'`);

// Grant updates must preserve the real grantee and authorize both old and new scopes.
r=await q(`select id from boh_vault_access_grants where tenant_id='${ids.t1}' and boh_user_id='${ids.u1}' and environment='development' limit 1`);
const developmentGrant=r.rows[0].id;
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await rejects(`select boh_vault_mutate_access_grant('${developmentGrant}','${ids.t1}','${ids.u2}','vault_admin','development','suspended','${ids.u1}','fake-grantee','test-service')`,/grantee identity is immutable/i);
await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='fake-grantee'`); assert.equal(r.rows[0].n,0);
await exec(`insert into boh_vault_access_grants(id,tenant_id,boh_user_id,role,environment,status,granted_by) values('80000000-0000-0000-0000-000000000001','${ids.t1}','${ids.u1}','vault_viewer','production','active','${ids.u1}')`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await rejects(`select boh_vault_mutate_access_grant('80000000-0000-0000-0000-000000000001','${ids.t1}','${ids.u1}','vault_viewer','development','revoked','${ids.u1}','cross-scope-grant','test-service')`,/not an authorized Vault admin/i);
await exec(`reset role`);

// Relationship and crypto-history behavior.
await rejects(`insert into boh_vault_secret_versions(tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,wrapped_data_key) values('${ids.t1}','${ids.i1}','${ids.f2}','${ids.k1}',1,'c','n','w')`,/foreign key|protected field/i);
await rejects(`insert into boh_vault_secret_versions(tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,wrapped_data_key) values('${ids.t1}','${ids.i1}','${ids.fp}','${ids.k1}',1,'c','n','w')`,/protected field/i);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_commit_secret_version('${ids.t1}','${ids.i1}','${ids.fs}','${ids.k1}','${ids.u1}','cipher','nonce','data-key','req-1','test-service') id`);
const secret=r.rows[0].id; await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where subject_id='${secret}' and event_type='secret_version_committed'`); assert.equal(r.rows[0].n,1);

// Protected service APIs expose only encrypted envelopes and atomically audit human reveal/copy.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select * from boh_vault_get_active_tenant_key('${ids.t1}','${ids.u1}','development','test-service','key-read-1')`);
assert.equal(r.rows[0].tenant_key_id,ids.k1); assert.equal(r.rows[0].wrapped_key,'wrapped');
r=await q(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i1}','${ids.fs}','${ids.u1}','development','test-service','reveal-1','revealed')`);
assert.equal(r.rows[0].secret_version_id,secret); assert.equal(r.rows[0].ciphertext,'cipher'); assert.equal(r.rows[0].wrapped_key,'wrapped');
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i1}','${ids.fs}','${ids.u1}','development','test-service','bad-event','deleted')`,/revealed or copied/i);
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t2}','${ids.i2}','${ids.f2}','${ids.u1}','development','test-service','cross-tenant','revealed')`,/not an authorized Vault admin or editor/i);
await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='reveal-1' and event_type='revealed' and subject_id='${secret}'`); assert.equal(r.rows[0].n,1);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id in ('bad-event','cross-tenant')`); assert.equal(r.rows[0].n,0);

r=await q(`select value_state from boh_vault_items where id='${ids.i1}'`); assert.equal(r.rows[0].value_state,'configured');
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await q(`select boh_vault_upsert_item_field('${ids.fr}','${ids.t1}','${ids.i1}','development','client_certificate','Client certificate','protected',null,true,10,'{}'::jsonb,'${ids.u1}','required-field-added','test-service')`);
await exec(`reset role`);
r=await q(`select value_state from boh_vault_items where id='${ids.i1}'`); assert.equal(r.rows[0].value_state,'needs_setup','adding a missing required protected field must immediately invalidate readiness');
await rejects(`update boh_vault_secret_versions set ciphertext='changed' where id='${secret}'`,/immutable/i);
await rejects(`delete from boh_vault_secret_versions where id='${secret}'`,/cannot be deleted/i);
await rejects(`update boh_vault_tenant_keys set wrapped_key='changed' where id='${ids.k1}'`,/immutable/i);
await rejects(`delete from boh_vault_tenant_keys where id='${ids.k1}'`,/cannot be deleted/i);
await rejects(`update boh_vault_audit_events set event_type='copied'`,/append-only|cannot be mutated/i);
await rejects(`delete from boh_vault_audit_events`,/append-only|cannot be mutated/i);

// Root uniqueness and exact protected-version sync lifecycle through audited RPCs.
await exec(`insert into boh_vault_collections(tenant_id,environment,name) values('${ids.t1}','development','Root')`);
await rejects(`insert into boh_vault_collections(tenant_id,environment,name) values('${ids.t1}','development','Root')`,/unique/i);
await exec(`insert into boh_vault_deployment_adapters(id,adapter_key,display_name) values('70000000-0000-0000-0000-000000000001','signed_webhook','Signed webhook')`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_create_deployment_target('${ids.t1}','70000000-0000-0000-0000-000000000001','target','Target','development','https://runner.example.test/vault-sync','${ids.u1}','sync-service','target-create','{}'::jsonb) id`);
const target=r.rows[0].id;
r=await q(`select boh_vault_create_sync_binding('${ids.t1}','${ids.i1}','${ids.fs}','${target}','development','DEST','runtime_secret_sync','${ids.u1}','sync-service','binding-create') id`);
const binding=r.rows[0].id;
await q(`select boh_vault_update_sync_binding('${ids.t1}','${binding}','ready','${ids.u1}','sync-service','binding-ready')`);
r=await q(`select boh_vault_request_sync_run('${ids.t1}','${binding}','${secret}','${ids.u1}','sync-service','sync-requested','run-request-1') id`);
const run=r.rows[0].id;
await rejects(`select * from boh_vault_claim_sync_run('${ids.t1}','${run}','${ids.u2}','sync-service','sync-claim-cross-tenant')`,/not authorized/i);
r=await q(`select * from boh_vault_claim_sync_run('${ids.t1}','${run}','${ids.u1}','sync-service','sync-started')`);
assert.equal(r.rows[0].adapter_key,'signed_webhook');
assert.equal(r.rows[0].target_url,'https://runner.example.test/vault-sync');
assert.equal(r.rows[0].destination_key,'DEST');
assert.equal(r.rows[0].secret_version_id,secret);
assert.equal(r.rows[0].ciphertext,'cipher');
assert.equal(r.rows[0].wrapped_key,'wrapped');
await q(`select boh_vault_complete_sync_run('${ids.t1}','${run}','ok','${ids.u1}','sync-service','sync-completed')`);
await exec(`reset role`);
r=await q(`select status,secret_version_id from boh_vault_sync_runs where id='${run}'`);
assert.deepEqual(r.rows[0],{status:'succeeded',secret_version_id:secret});
r=await q(`select last_synced_secret_version_id from boh_vault_sync_bindings where id='${binding}'`);
assert.equal(r.rows[0].last_synced_secret_version_id,secret);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_request_active_sync_run('${ids.t1}','${binding}','${ids.u1}','sync-service','sync-active-requested','run-request-active-1') id`);
const activeRun=r.rows[0].id;
await exec(`reset role`);
r=await q(`select status,secret_version_id from boh_vault_sync_runs where id='${activeRun}'`);
assert.deepEqual(r.rows[0],{status:'queued',secret_version_id:secret});
await rejects(`update boh_vault_sync_runs set status='running',completed_at=null,result_code=null where id='${run}'`,/invalid sync(?: run)? transition|immutable|check constraint/i);
await rejects(`delete from boh_vault_sync_runs`,/cannot be deleted/i);

// Browser roles have no direct writes or protected reads.
r=await q(`select has_table_privilege('authenticated','boh_vault_items','insert') item_write,has_table_privilege('authenticated','boh_vault_secret_versions','select') secret_read`);
assert.deepEqual(r.rows[0],{item_write:false,secret_read:false});

// UI reads access and adapter metadata only through explicit safe views.
r=await q(`select has_table_privilege('authenticated','boh_vault_access_grants_safe','select') grants_safe,has_table_privilege('authenticated','boh_vault_deployment_adapters_safe','select') adapters_safe`);
assert.deepEqual(r.rows[0],{grants_safe:true,adapters_safe:true});
await exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false)`);
r=await q(`select role,status from boh_vault_access_grants_safe where tenant_id='${ids.t1}' and boh_user_id='${ids.u1}'`);
assert.equal(r.rows.some((row)=>row.role==='vault_admin'&&row.status==='active'),true);
r=await q(`select adapter_key from boh_vault_deployment_adapters_safe`);
assert.equal(r.rows.some((row)=>row.adapter_key==='signed_webhook'),true);
await exec(`reset role`);

// Deleting an item archives it atomically: safe reads hide it, bindings are
// disabled, protected reads stop, and immutable history remains audited.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await q(`select boh_vault_archive_item('${ids.t1}','${ids.i1}','development','${ids.u1}','test-service','item-delete-1')`);
await exec(`reset role`);
r=await q(`select value_state from boh_vault_items where id='${ids.i1}'`); assert.equal(r.rows[0].value_state,'disabled');
r=await q(`select state from boh_vault_sync_bindings where id='${binding}'`); assert.equal(r.rows[0].state,'disabled');
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i1}','${ids.fs}','${ids.u1}','development','test-service','deleted-read','revealed')`,/No active protected Vault value/i);
await exec(`reset role;set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select count(*)::int n from boh_vault_items_safe where id='${ids.i1}'`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_item_fields_safe where vault_item_id='${ids.i1}'`); assert.equal(r.rows[0].n,0);
await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='item-delete-1' and event_type='item_deleted'`); assert.equal(r.rows[0].n,1);
r=await q(`select count(*)::int n from boh_vault_secret_versions where id='${secret}'`); assert.equal(r.rows[0].n,1);

// Legacy import stays readiness-only; bootstrap grant is audit-coupled; bridge DML is closed.
const legacy=await readFile(new URL('../manual_sql/20260715_import_legacy_central_credential_metadata_boh_dev.sql',import.meta.url),'utf8');
assert.match(legacy,/'needs_setup'::text as value_state/); assert.doesNotMatch(legacy,/when 'configured' then 'configured'/);
const bootstrap=await readFile(new URL('../manual_sql/20260715_enable_boh_vault_and_grant_named_user_boh_dev.sql',import.meta.url),'utf8');
assert.match(bootstrap,/'grant_created'/); assert.match(bootstrap,/boh_vault_audit_events/);
r=await q(`select has_table_privilege('service_role','boh_vault_legacy_credential_bridge','insert') can_insert,has_table_privilege('service_role','boh_vault_legacy_credential_bridge','update') can_update,has_table_privilege('service_role','boh_vault_legacy_credential_bridge','delete') can_delete`);
assert.deepEqual(r.rows[0],{can_insert:false,can_update:false,can_delete:false});
console.log('BOH Vault PGlite behavioral checks passed');
await db.close();
