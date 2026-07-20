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
 a1:'20000000-0000-0000-0000-000000000001', a2:'20000000-0000-0000-0000-000000000002', a3:'20000000-0000-0000-0000-000000000003', a4:'20000000-0000-0000-0000-000000000004',
 u1:'30000000-0000-0000-0000-000000000001', u2:'30000000-0000-0000-0000-000000000002', u3:'30000000-0000-0000-0000-000000000003', u4:'30000000-0000-0000-0000-000000000004',
 i1:'40000000-0000-0000-0000-000000000001', i2:'40000000-0000-0000-0000-000000000002', i3:'40000000-0000-0000-0000-000000000003', i4:'40000000-0000-0000-0000-000000000004', i5:'40000000-0000-0000-0000-000000000005',
 fp:'50000000-0000-0000-0000-000000000001', fs:'50000000-0000-0000-0000-000000000002', f2:'50000000-0000-0000-0000-000000000003', fr:'50000000-0000-0000-0000-000000000004', f3:'50000000-0000-0000-0000-000000000005', f4:'50000000-0000-0000-0000-000000000006',
 k1:'60000000-0000-0000-0000-000000000001', sl:'61000000-0000-0000-0000-000000000001', s4:'61000000-0000-0000-0000-000000000002',
 c1:'62000000-0000-0000-0000-000000000000', m1:'62000000-0000-0000-0000-000000000001', bl:'63000000-0000-0000-0000-000000000001', rl:'64000000-0000-0000-0000-000000000001'
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
 alter default privileges in schema public grant all on tables to anon, authenticated;
`);
for (const name of ['20260715090000_create_boh_vault_core.sql','20260715091000_create_boh_vault_sync_targets.sql','20260715092000_register_boh_vault_app.sql','20260715093000_prepare_boh_vault_legacy_bridge.sql','20260715094000_create_boh_vault_secret_api.sql','20260715095000_create_boh_vault_sync_api.sql','20260715096000_create_boh_vault_ui_safe_views.sql','20260715097000_create_boh_vault_active_sync_request.sql','20260715103000_archive_boh_vault_items.sql','20260715104000_register_supabase_edge_secrets_adapter.sql','20260715105000_separate_vault_sync_request_and_dispatch_identity.sql','20260717113000_add_vault_item_details_edit.sql','20260717120000_harden_vault_safe_views.sql','20260717122000_add_vault_item_description.sql','20260719220000_enable_central_vault_environments.sql'])
  await exec(await readFile(new URL(`../migrations/${name}`, import.meta.url),'utf8'));

await exec(`
 insert into auth.users values('${ids.a1}','one@example.test'),('${ids.a2}','two@example.test'),('${ids.a3}','three@example.test'),('${ids.a4}','four@example.test');
 insert into boh_tenant(id,slug,name,status) values('${ids.t1}','one','One','active'),('${ids.t2}','two','Two','active');
 insert into boh_user(id,auth_user_id,tenant_id,app_context,status) values('${ids.u1}','${ids.a1}','${ids.t1}','boh','active'),('${ids.u2}','${ids.a2}','${ids.t2}','boh','active'),('${ids.u3}','${ids.a3}','${ids.t1}','boh','active'),('${ids.u4}','${ids.a4}','${ids.t1}','boh','active');
 insert into boh_tenant_member(tenant_id,user_id,membership_status) values('${ids.t1}','${ids.u1}','active'),('${ids.t2}','${ids.u2}','active'),('${ids.t1}','${ids.u3}','active'),('${ids.t1}','${ids.u4}','active');
 insert into boh_tenant_app(tenant_id,app_id,status,app_kind) select '${ids.t1}',id,'enabled','boh' from boh_app where slug='vault';
 insert into boh_tenant_app(tenant_id,app_id,status,app_kind) select '${ids.t2}',id,'enabled','boh' from boh_app where slug='vault';
 insert into boh_vault_access_grants(tenant_id,boh_user_id,role,environment,status,granted_by,created_at,updated_at) values('${ids.t1}','${ids.u1}','vault_admin','development','active','${ids.u1}',now()-interval '2 minutes',now()),('${ids.t2}','${ids.u2}','vault_admin','development','active','${ids.u2}',now()-interval '2 minutes',now()),('${ids.t1}','${ids.u3}','vault_viewer','development','active','${ids.u1}',now()-interval '2 minutes',now()),('${ids.t1}','${ids.u4}','sync_operator','development','active','${ids.u1}',now()-interval '2 minutes',now());
 insert into boh_vault_access_grants(tenant_id,boh_user_id,role,environment,status,granted_by,created_at,updated_at) values('${ids.t1}','${ids.u4}','vault_admin',null,'active','${ids.u1}',now()-interval '2 minutes',now());
 insert into boh_vault_items(id,tenant_id,item_key,display_name,item_type,environment,owner_boh_user_id,created_by) values('${ids.i1}','${ids.t1}','one','One','credential','development','${ids.u1}','${ids.u1}'),('${ids.i2}','${ids.t2}','two','Two','credential','development','${ids.u2}','${ids.u2}'),('${ids.i3}','${ids.t1}','private-login','Private login','login','development','${ids.u1}','${ids.u3}');
 insert into boh_vault_item_fields(id,tenant_id,vault_item_id,field_key,label,field_kind,plaintext_value,created_by,updated_by) values('${ids.fp}','${ids.t1}','${ids.i1}','url','URL','plaintext','https://safe.test','${ids.u1}','${ids.u1}'),('${ids.fs}','${ids.t1}','${ids.i1}','value','Value','protected',null,'${ids.u1}','${ids.u1}'),('${ids.f2}','${ids.t2}','${ids.i2}','value','Value','protected',null,'${ids.u2}','${ids.u2}'),('${ids.f3}','${ids.t1}','${ids.i3}','PASSWORD','Password','protected',null,'${ids.u3}','${ids.u3}');
 insert into boh_vault_tenant_keys(id,tenant_id,key_version,wrapping_key_ref,wrapped_key,algorithm,state,activated_at,created_by) values('${ids.k1}','${ids.t1}',1,'kms://one','wrapped','AES-256-GCM','active',now(),'${ids.u1}');
 insert into boh_vault_collections(id,tenant_id,environment,name,created_by,updated_by) values('${ids.c1}','${ids.t1}','development','Legacy shared passwords','${ids.u1}','${ids.u1}');
 insert into boh_vault_collection_items(id,tenant_id,environment,collection_id,vault_item_id,added_by) values('${ids.m1}','${ids.t1}','development','${ids.c1}','${ids.i3}','${ids.u1}');
`);
await exec(await readFile(new URL('../migrations/20260719223000_enforce_vault_item_access_by_kind.sql', import.meta.url),'utf8'));
await exec(await readFile(new URL('../migrations/20260720120000_make_vault_safe_views_read_only.sql', import.meta.url),'utf8'));
await exec(await readFile(new URL('../migrations/20260720123000_enable_canonical_supabase_vault_targets.sql', import.meta.url),'utf8'));
let r;
r=await q(`select owner_boh_user_id from boh_vault_items where id='${ids.i3}'`); assert.equal(r.rows[0].owner_boh_user_id,ids.u3);
r=await q(`select count(*)::int n from boh_vault_collection_items where id='${ids.m1}'`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='migration:password-collection:${ids.m1}' and event_type='collection_membership_removed'`); assert.equal(r.rows[0].n,1);
r=await q(`select environment from boh_vault_access_grants where tenant_id='${ids.t1}' and boh_user_id='${ids.u4}' and role='vault_admin'`); assert.deepEqual(r.rows,[{environment:'development'}]);
r=await q(`select boh_vault_user_has_exact_environment_role('${ids.t1}','${ids.u4}',array['vault_admin'],'development') development,boh_vault_user_has_exact_environment_role('${ids.t1}','${ids.u4}',array['vault_admin'],'production') production`); assert.deepEqual(r.rows[0],{development:true,production:false});
r=await q(`select is_nullable from information_schema.columns where table_schema='public' and table_name='boh_vault_access_grants' and column_name='environment'`); assert.equal(r.rows[0].is_nullable,'NO');
await exec(`update boh_vault_access_grants set status='revoked',revoked_by='${ids.u1}' where tenant_id='${ids.t1}' and boh_user_id='${ids.u4}' and role='vault_admin'`);

// First-use key bootstrap is service-only, audited, and idempotent.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select * from boh_vault_initialize_tenant_key_for_item('${ids.t2}','${ids.i2}','${ids.u2}','development','env:BOH_VAULT_MASTER_KEY_V1','v1.bootstrap.ciphertext','test-service','tenant-key-init-t2')`);
const initializedTenantKey=r.rows[0].tenant_key_id;
r=await q(`select * from boh_vault_initialize_tenant_key_for_item('${ids.t2}','${ids.i2}','${ids.u2}','development','env:BOH_VAULT_MASTER_KEY_V1','v1.ignored.concurrent','test-service','tenant-key-init-t2-retry')`);
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
await rejects(`insert into boh_vault_access_grants(tenant_id,boh_user_id,role,environment,status) values('${ids.t1}','${ids.u1}','gateway_operator','development','active')`,/check constraint/i);
await rejects(`insert into boh_vault_items(tenant_id,item_key,display_name,item_type,environment,owner_boh_user_id,created_by) values('${ids.t1}','note','note','secure_note','development','${ids.u1}','${ids.u1}')`,/check constraint/i);

// JWT/tenant behavior and safe CASE-protected plaintext contract.
await exec(`set role authenticated; select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select private.boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok,private.boh_vault_has_role('${ids.t2}',array['vault_admin'],'development') cross`);
assert.deepEqual(r.rows[0],{ok:true,cross:false});
r=await q(`select id from boh_vault_items_safe order by id`);
assert.deepEqual(r.rows.map((row)=>row.id),[ids.i1],'an administrator must not see another user\'s password item');
r=await q(`select field_kind,plaintext_value from boh_vault_item_fields_safe order by field_kind`);
assert.deepEqual(r.rows,[{field_kind:'plaintext',plaintext_value:'https://safe.test'},{field_kind:'protected',plaintext_value:null}]);
await exec(`reset role`);
await exec(`set role authenticated; select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.sub','${ids.a3}',false)`);
r=await q(`select id from boh_vault_items_safe order by id`);
assert.deepEqual(r.rows.map((row)=>row.id),[ids.i3],'a Vault user must see only their own password items');
r=await q(`select vault_item_id from boh_vault_item_fields_safe order by vault_item_id`);
assert.deepEqual(r.rows.map((row)=>row.vault_item_id),[ids.i3]);
await exec(`reset role`);

// A Vault viewer can manage only a password they create; shared credentials remain admin-only.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_upsert_item('${ids.i4}','${ids.t1}','viewer-login','Viewer login','login',null,null,'development',null,null,'${ids.u3}','viewer-login-created','test-service') id`);
assert.equal(r.rows[0].id,ids.i4);
r=await q(`select boh_vault_upsert_item_field('${ids.f4}','${ids.t1}','${ids.i4}','development','PASSWORD','Password','protected',null,true,0,'{}'::jsonb,'${ids.u3}','viewer-login-field','test-service') id`);
assert.equal(r.rows[0].id,ids.f4);
r=await q(`select boh_vault_update_item_details_v2('${ids.i4}','${ids.t1}','development','Viewer login updated',null,null,null,null,'${ids.u3}','viewer-login-edited','test-service') id`);
assert.equal(r.rows[0].id,ids.i4);
await rejects(`select boh_vault_upsert_item('${ids.i5}','${ids.t1}','viewer-api','Viewer API','credential',null,null,'development',null,null,'${ids.u3}','viewer-api-rejected','test-service')`,/cannot create|not authorized/i);
r=await q(`select * from boh_vault_get_active_tenant_key_for_item('${ids.t1}','${ids.i4}','${ids.u3}','development','test-service','viewer-key-read')`);
assert.equal(r.rows[0].tenant_key_id,ids.k1);
r=await q(`select boh_vault_commit_secret_version('${ids.t1}','${ids.i4}','${ids.f4}','${ids.k1}','${ids.u3}','viewer-cipher','viewer-nonce','viewer-data-key','viewer-password-set','test-service') id`);
const viewerSecret=r.rows[0].id;
await rejects(`select * from boh_vault_get_active_tenant_key_for_item('${ids.t1}','${ids.i1}','${ids.u3}','development','test-service','viewer-shared-key-read')`,/cannot access this Vault item/i);
await rejects(`select boh_vault_update_item_details_v2('${ids.i3}','${ids.t1}','development','Admin changed private login',null,null,null,null,'${ids.u1}','admin-password-edit','test-service')`,/cannot modify this Vault item/i);
await exec(`reset role`);
r=await q(`select created_by,owner_boh_user_id,display_name from boh_vault_items where id='${ids.i4}'`);
assert.deepEqual(r.rows[0],{created_by:ids.u3,owner_boh_user_id:ids.u3,display_name:'Viewer login updated'});
r=await q(`select count(*)::int n from boh_vault_items where id='${ids.i5}'`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='viewer-api-rejected'`); assert.equal(r.rows[0].n,0);
for (const mutation of [
  `update boh_vault_items set created_by='${ids.u1}',updated_by='${ids.u3}' where id='${ids.i4}'`,
  `update boh_vault_items set owner_boh_user_id='${ids.u1}',updated_by='${ids.u3}' where id='${ids.i4}'`,
  `update boh_vault_items set item_type='credential',updated_by='${ids.u3}' where id='${ids.i4}'`,
  `update boh_vault_items set tenant_id='${ids.t2}',updated_by='${ids.u3}' where id='${ids.i4}'`,
  `update boh_vault_items set environment='production',updated_by='${ids.u3}' where id='${ids.i4}'`,
]) await rejects(mutation,/immutable/i);

for (const [mutate,restore] of [
 [`update boh_user set status='suspended' where id='${ids.u1}'`,`update boh_user set status='active' where id='${ids.u1}'`],
 [`update boh_tenant set status='suspended' where id='${ids.t1}'`,`update boh_tenant set status='active' where id='${ids.t1}'`],
 [`update boh_tenant_member set membership_status='inactive' where user_id='${ids.u1}'`,`update boh_tenant_member set membership_status='active' where user_id='${ids.u1}'`],
 [`update boh_tenant_app set status='disabled' where tenant_id='${ids.t1}'`,`update boh_tenant_app set status='enabled' where tenant_id='${ids.t1}'`],
 [`update boh_vault_access_grants set expires_at=now()-interval '1 minute' where boh_user_id='${ids.u1}'`,`update boh_vault_access_grants set expires_at=null where boh_user_id='${ids.u1}'`],
 [`update boh_vault_access_grants set status='revoked',revoked_by='${ids.u1}' where boh_user_id='${ids.u1}'`,`update boh_vault_access_grants set status='active',revoked_by=null where boh_user_id='${ids.u1}'`]
]) {
 await exec(mutate); await exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
 r=await q(`select private.boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok`); assert.equal(r.rows[0].ok,false,mutate);
 await exec(`reset role;${restore}`);
}
await exec(`update boh_vault_access_grants set environment='production' where boh_user_id='${ids.u1}'`);
r=await q(`select private.boh_vault_has_role('${ids.t1}',array['vault_admin'],'development') ok`); assert.equal(r.rows[0].ok,false);
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
await rejects(`insert into boh_vault_secret_versions(tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,wrapped_data_key,created_by) values('${ids.t1}','${ids.i1}','${ids.f2}','${ids.k1}',1,'c','n','w','${ids.u1}')`,/foreign key|protected field/i);
await rejects(`insert into boh_vault_secret_versions(tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,wrapped_data_key,created_by) values('${ids.t1}','${ids.i1}','${ids.fp}','${ids.k1}',1,'c','n','w','${ids.u1}')`,/protected field/i);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_commit_secret_version('${ids.t1}','${ids.i1}','${ids.fs}','${ids.k1}','${ids.u1}','cipher','nonce','data-key','req-1','test-service') id`);
const secret=r.rows[0].id; await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where subject_id='${secret}' and event_type='secret_version_committed'`); assert.equal(r.rows[0].n,1);

// Protected service APIs expose only encrypted envelopes and atomically audit human reveal/copy.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select * from boh_vault_get_active_tenant_key_for_item('${ids.t1}','${ids.i1}','${ids.u1}','development','test-service','key-read-1')`);
assert.equal(r.rows[0].tenant_key_id,ids.k1); assert.equal(r.rows[0].wrapped_key,'wrapped');
r=await q(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i1}','${ids.fs}','${ids.u1}','development','test-service','reveal-1','revealed')`);
assert.equal(r.rows[0].secret_version_id,secret); assert.equal(r.rows[0].ciphertext,'cipher'); assert.equal(r.rows[0].wrapped_key,'wrapped');
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i1}','${ids.fs}','${ids.u1}','development','test-service','bad-event','deleted')`,/revealed or copied/i);
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t2}','${ids.i2}','${ids.f2}','${ids.u1}','development','test-service','cross-tenant','revealed')`,/cannot access this Vault item|not an authorized Vault admin or editor/i);
await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id='reveal-1' and event_type='revealed' and subject_id='${secret}'`); assert.equal(r.rows[0].n,1);
r=await q(`select count(*)::int n from boh_vault_audit_events where request_id in ('bad-event','cross-tenant')`); assert.equal(r.rows[0].n,0);

// Password envelopes are creator-private even from another Vault administrator.
await exec(`insert into boh_vault_secret_versions(id,tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,wrapped_data_key,state,created_by,activated_at) values('${ids.sl}','${ids.t1}','${ids.i3}','${ids.f3}','${ids.k1}',1,'private-cipher','private-nonce','private-data-key','active','${ids.u3}',now())`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i3}','${ids.f3}','${ids.u1}','development','test-service','admin-password-read','revealed')`,/cannot access this Vault item/i);
await rejects(`select boh_vault_commit_secret_version('${ids.t1}','${ids.i3}','${ids.f3}','${ids.k1}','${ids.u1}','guessed-cipher','guessed-nonce','guessed-key','admin-password-write','test-service')`,/cannot modify this Vault item/i);
await rejects(`select * from boh_vault_get_active_tenant_key_for_item('${ids.t1}','${ids.i1}','${ids.u1}','production','test-service','wrong-environment-key-read')`,/cannot access this Vault item/i);
r=await q(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i3}','${ids.f3}','${ids.u3}','development','test-service','owner-password-read','revealed')`);
assert.equal(r.rows[0].secret_version_id,ids.sl);
await exec(`reset role;set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select count(*)::int n from boh_vault_audit_events_safe where request_id='owner-password-read'`); assert.equal(r.rows[0].n,0,'another administrator must not see password activity');
await exec(`reset role;set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a3}',false)`);
r=await q(`select count(*)::int n from boh_vault_audit_events_safe where request_id='owner-password-read'`); assert.equal(r.rows[0].n,1,'the password creator can see their own activity');
await exec(`reset role`);

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
const root=(await q(`select id from boh_vault_collections where tenant_id='${ids.t1}' and name='Root'`)).rows[0].id;
await exec(`insert into boh_vault_deployment_adapters(id,adapter_key,display_name) values('70000000-0000-0000-0000-000000000001','signed_webhook','Signed webhook')`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_create_deployment_target('${ids.t1}','70000000-0000-0000-0000-000000000001','target','Target','development','https://runner.example.test/vault-sync','${ids.u1}','sync-service','target-create','{}'::jsonb) id`);
const target=r.rows[0].id;
await rejects(`select boh_vault_set_collection_membership('${ids.m1}','${ids.t1}','development','${root}','${ids.i3}',true,'${ids.u1}','password-collection-rejected','sync-service')`,/permission denied|Personal passwords cannot be synchronized/i);
await rejects(`select boh_vault_create_sync_binding('${ids.t1}','${ids.i3}','${ids.f3}','${target}','development','PASSWORD','runtime_secret_sync','${ids.u1}','sync-service','password-binding-rejected')`,/Personal passwords cannot be synchronized/i);
await exec(`reset role`);
r=await q(`select count(*)::int n from boh_vault_sync_bindings where vault_item_id='${ids.i3}'`); assert.equal(r.rows[0].n,0);

// Even pre-existing password connections and queued runs cannot be requested or claimed.
await exec(`alter table boh_vault_sync_bindings disable trigger boh_vault_sync_bindings_item_kind_guard;alter table boh_vault_sync_runs disable trigger boh_vault_sync_runs_item_kind_guard`);
await exec(`insert into boh_vault_sync_bindings(id,tenant_id,vault_item_id,item_field_id,deployment_target_id,environment,destination_key,sync_mode,state,created_by,updated_by) values('${ids.bl}','${ids.t1}','${ids.i3}','${ids.f3}','${target}','development','LEGACY_PASSWORD','runtime_secret_sync','ready','${ids.u1}','${ids.u1}')`);
await exec(`insert into boh_vault_sync_runs(id,tenant_id,binding_id,vault_item_id,item_field_id,secret_version_id,environment,status,request_id,service_identity,requested_by) values('${ids.rl}','${ids.t1}','${ids.bl}','${ids.i3}','${ids.f3}','${ids.sl}','development','queued','legacy-password-run','sync-service','${ids.u1}')`);
await exec(`alter table boh_vault_sync_bindings enable trigger boh_vault_sync_bindings_item_kind_guard;alter table boh_vault_sync_runs enable trigger boh_vault_sync_runs_item_kind_guard`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await rejects(`select boh_vault_request_active_sync_run('${ids.t1}','${ids.bl}','${ids.u1}','sync-service','legacy-password-request','legacy-password-request-id')`,/Personal passwords cannot be synchronized/i);
await rejects(`select * from boh_vault_claim_sync_run('${ids.t1}','${ids.rl}','${ids.u1}','sync-service','legacy-password-claim')`,/Personal passwords cannot be synchronized/i);
await exec(`reset role`);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_create_sync_binding('${ids.t1}','${ids.i1}','${ids.fs}','${target}','development','DEST','runtime_secret_sync','${ids.u1}','sync-service','binding-create') id`);
const binding=r.rows[0].id;
await q(`select boh_vault_update_sync_binding('${ids.t1}','${binding}','ready','${ids.u1}','sync-service','binding-ready')`);
await rejects(`select boh_vault_request_active_sync_run('${ids.t1}','${binding}','${ids.u4}','sync-service','operator-sync-request','operator-run-request')`,/not an authorized Vault administrator/i);
r=await q(`select boh_vault_request_active_sync_run('${ids.t1}','${binding}','${ids.u1}','sync-service','sync-requested','run-request-1') id`);
const run=r.rows[0].id;
await rejects(`select * from boh_vault_claim_sync_run('${ids.t1}','${run}','${ids.u2}','sync-service','sync-claim-cross-tenant')`,/not an? authorized/i);
r=await q(`select * from boh_vault_claim_sync_run('${ids.t1}','${run}','${ids.u1}','sync-service','sync-started')`);
assert.equal(r.rows[0].adapter_key,'signed_webhook');
assert.equal(r.rows[0].target_url,'https://runner.example.test/vault-sync');
assert.equal(r.rows[0].destination_key,'DEST');
assert.equal(r.rows[0].secret_version_id,secret);
assert.equal(r.rows[0].ciphertext,'cipher');
assert.equal(r.rows[0].wrapped_key,'wrapped');
await rejects(`select boh_vault_complete_sync_run('${ids.t1}','${run}','operator-complete','${ids.u4}','sync-service','operator-sync-complete')`,/not an authorized Vault administrator/i);
await rejects(`select boh_vault_fail_sync_run('${ids.t1}','${run}','operator-fail','${ids.u4}','sync-service','operator-sync-fail')`,/not an authorized Vault administrator/i);
await exec(`reset role`);
r=await q(`select status from boh_vault_sync_runs where id='${run}'`); assert.equal(r.rows[0].status,'running');
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await q(`select boh_vault_complete_sync_run('${ids.t1}','${run}','ok','${ids.u1}','sync-service','sync-completed')`);
await exec(`reset role`);
r=await q(`select status,secret_version_id from boh_vault_sync_runs where id='${run}'`);
assert.deepEqual(r.rows[0],{status:'succeeded',secret_version_id:secret});
r=await q(`select last_synced_secret_version_id from boh_vault_sync_bindings where id='${binding}'`);
assert.equal(r.rows[0].last_synced_secret_version_id,secret);
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
r=await q(`select boh_vault_request_active_sync_run('${ids.t1}','${binding}','${ids.u1}','sync-service','sync-active-requested','run-request-active-1') id`);
const activeRun=r.rows[0].id;
await rejects(`select * from boh_vault_claim_sync_run('${ids.t1}','${activeRun}','${ids.u4}','sync-service','operator-sync-claim')`,/not an authorized Vault administrator/i);
await exec(`reset role`);
r=await q(`select status,secret_version_id from boh_vault_sync_runs where id='${activeRun}'`);
assert.deepEqual(r.rows[0],{status:'queued',secret_version_id:secret});
await rejects(`update boh_vault_sync_runs set status='running',completed_at=null,result_code=null where id='${run}'`,/invalid sync(?: run)? transition|immutable|check constraint/i);
await rejects(`delete from boh_vault_sync_runs`,/cannot be deleted/i);

// Browser roles have no direct writes or protected reads.
r=await q(`select has_table_privilege('authenticated','boh_vault_items','insert') item_write,has_table_privilege('authenticated','boh_vault_secret_versions','select') secret_read`);
assert.deepEqual(r.rows[0],{item_write:false,secret_read:false});
r=await q(`select has_table_privilege('service_role','boh_vault_items','select') item_read,has_table_privilege('service_role','boh_vault_audit_events','insert') audit_write`);
assert.deepEqual(r.rows[0],{item_read:false,audit_write:false},'service operations must use audited Vault RPCs');

// UI reads access and adapter metadata only through explicit safe views.
r=await q(`select has_table_privilege('authenticated','boh_vault_access_grants_safe','select') grants_safe,has_table_privilege('authenticated','boh_vault_deployment_adapters_safe','select') adapters_safe`);
assert.deepEqual(r.rows[0],{grants_safe:true,adapters_safe:true});
r=await q(`select capabilities->'supported_environments' supported_environments,capabilities ? 'development_only' development_only from boh_vault_deployment_adapters where adapter_key='supabase_edge_secrets'`);
assert.deepEqual(r.rows[0],{supported_environments:['development','production'],development_only:false});
r=await q(`select count(*)::int n from information_schema.views v where v.table_schema='public' and v.table_name like 'boh_vault_%_safe' and (has_table_privilege('authenticated',format('%I.%I',v.table_schema,v.table_name),'insert') or has_table_privilege('authenticated',format('%I.%I',v.table_schema,v.table_name),'update') or has_table_privilege('authenticated',format('%I.%I',v.table_schema,v.table_name),'delete'))`);
assert.equal(r.rows[0].n,0,'Vault safe views must be authenticated SELECT-only');
await exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select role,status from boh_vault_access_grants_safe where tenant_id='${ids.t1}' and boh_user_id='${ids.u1}'`);
assert.equal(r.rows.some((row)=>row.role==='vault_admin'&&row.status==='active'),true);
r=await q(`select adapter_key from boh_vault_deployment_adapters_safe`);
assert.equal(r.rows.some((row)=>row.adapter_key==='signed_webhook'),true);
await exec(`reset role`);
await exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a3}',false)`);
r=await q(`select boh_user_id,role from boh_vault_access_grants_safe`);
assert.deepEqual(r.rows,[{boh_user_id:ids.u3,role:'vault_viewer'}],'non-admins may read only their own grant');
r=await q(`select count(*)::int n from boh_vault_deployment_adapters_safe`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_collections_safe`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_sync_bindings_safe`); assert.equal(r.rows[0].n,0);
r=await q(`select count(*)::int n from boh_vault_sync_runs_safe`); assert.equal(r.rows[0].n,0);
await exec(`reset role`);
r=await q(`select has_function_privilege('service_role','boh_vault_get_active_tenant_key(uuid,uuid,text,text,text)','execute') old_key_api,has_function_privilege('service_role','boh_vault_get_active_tenant_key_for_item(uuid,uuid,uuid,text,text,text)','execute') item_key_api`);
assert.deepEqual(r.rows[0],{old_key_api:false,item_key_api:true});
r=await q(`select has_function_privilege('service_role','boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text)','execute') direct_request,has_function_privilege('service_role','boh_vault_start_sync_run(uuid,uuid,uuid,text,text)','execute') direct_start,has_function_privilege('service_role','boh_vault_cancel_sync_run(uuid,uuid,uuid,text,text)','execute') direct_cancel`);
assert.deepEqual(r.rows[0],{direct_request:false,direct_start:false,direct_cancel:false});
r=await q(`select proname,count(*)::int overloads from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'boh_vault_%' and has_function_privilege('service_role',p.oid,'execute') group by proname order by proname`);
assert.deepEqual(r.rows,[
  ['boh_vault_archive_item','boh_vault_claim_sync_run','boh_vault_commit_secret_version','boh_vault_complete_sync_run','boh_vault_create_deployment_target','boh_vault_create_sync_binding','boh_vault_fail_sync_run','boh_vault_get_active_tenant_key_for_item','boh_vault_initialize_tenant_key_for_item','boh_vault_mutate_access_grant','boh_vault_read_secret_envelope','boh_vault_request_active_sync_run','boh_vault_update_item_details_v2','boh_vault_update_sync_binding','boh_vault_upsert_item','boh_vault_upsert_item_field'].map((proname)=>({proname,overloads:1})),
].flat(),'service_role may execute only the reviewed Edge Function RPC allowlist');

// A password creator can archive their item; another administrator cannot see its audit trail.
await exec(`set role service_role;select set_config('request.jwt.claim.role','service_role',false)`);
await q(`select boh_vault_archive_item('${ids.t1}','${ids.i4}','development','${ids.u3}','test-service','viewer-password-archived')`);
await rejects(`select * from boh_vault_read_secret_envelope('${ids.t1}','${ids.i4}','${ids.f4}','${ids.u3}','development','test-service','archived-password-read','revealed')`,/No active protected Vault value/i);
await exec(`reset role;set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a1}',false)`);
r=await q(`select count(*)::int n from boh_vault_audit_events_safe where request_id='viewer-password-archived'`); assert.equal(r.rows[0].n,0);
await exec(`reset role;set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${ids.a3}',false)`);
r=await q(`select count(*)::int n from boh_vault_audit_events_safe where request_id='viewer-password-archived'`); assert.equal(r.rows[0].n,1);
r=await q(`select count(*)::int n from boh_vault_items_safe where id='${ids.i4}'`); assert.equal(r.rows[0].n,0);
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
