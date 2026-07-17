const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const exec = (sql) => db.exec(sql);
const query = (sql) => db.query(sql);
const ids = {
  tenantOne: "10000000-0000-0000-0000-000000000001",
  tenantTwo: "10000000-0000-0000-0000-000000000002",
  authOne: "20000000-0000-0000-0000-000000000001",
  authTwo: "20000000-0000-0000-0000-000000000002",
  userOne: "30000000-0000-0000-0000-000000000001",
  userTwo: "30000000-0000-0000-0000-000000000002",
};

await exec(`
  create role anon; create role authenticated; create role service_role;
  alter default privileges in schema public grant all on tables to authenticated;
  create schema auth; create schema private;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table public.boh_tenant(id uuid primary key, status text not null);
  create table public.boh_user(id uuid primary key, auth_user_id uuid, tenant_id uuid, app_context text, status text);
  create table public.boh_tenant_member(id uuid primary key default gen_random_uuid(), tenant_id uuid, user_id uuid, membership_status text);
  create table public.boh_app(id uuid primary key, slug text unique, is_active boolean);
  create table public.boh_tenant_app(id uuid primary key default gen_random_uuid(), tenant_id uuid, app_id uuid, status text);
  create function private.current_boh_user_id() returns uuid language sql stable security definer set search_path=public,auth as $$ select id from public.boh_user where auth_user_id=auth.uid() limit 1 $$;
  insert into auth.users values ('${ids.authOne}'),('${ids.authTwo}');
  insert into public.boh_tenant values ('${ids.tenantOne}','active'),('${ids.tenantTwo}','active');
  insert into public.boh_user values ('${ids.userOne}','${ids.authOne}','${ids.tenantOne}','boh','active'),('${ids.userTwo}','${ids.authTwo}','${ids.tenantTwo}','boh','active');
  insert into public.boh_tenant_member(tenant_id,user_id,membership_status) values ('${ids.tenantOne}','${ids.userOne}','active'),('${ids.tenantTwo}','${ids.userTwo}','active');
  insert into public.boh_app values ('40000000-0000-0000-0000-000000000001','cookbook',true);
  insert into public.boh_tenant_app(tenant_id,app_id,status) values ('${ids.tenantOne}','40000000-0000-0000-0000-000000000001','enabled'),('${ids.tenantTwo}','40000000-0000-0000-0000-000000000001','enabled');
`);

const migration = await readFile(new URL("../migrations/20260717141000_create_cookbook_asset_studio.sql", import.meta.url), "utf8");
await exec(migration);

await exec(`
  insert into public.cookbook_asset(id,tenant_id,title,asset_type,created_by,updated_by) values
    ('50000000-0000-0000-0000-000000000001','${ids.tenantOne}','Tenant one page','web_page','${ids.userOne}','${ids.userOne}'),
    ('50000000-0000-0000-0000-000000000002','${ids.tenantTwo}','Tenant two page','web_page','${ids.userTwo}','${ids.userTwo}');
  insert into public.cookbook_asset_file(tenant_id,asset_id,path,content,mime_type,updated_by)
    values ('${ids.tenantOne}','50000000-0000-0000-0000-000000000001','index.html','<h1>One</h1>','text/html','${ids.userOne}');
  insert into public.cookbook_asset_version(id,tenant_id,asset_id,version_number,file_snapshot,created_by)
    values ('60000000-0000-0000-0000-000000000001','${ids.tenantOne}','50000000-0000-0000-0000-000000000001',1,'[{"path":"index.html"}]','${ids.userOne}');
`);

await assert.rejects(
  exec("update public.cookbook_asset_version set change_summary='changed' where id='60000000-0000-0000-0000-000000000001'"),
  /immutable/i,
);

await exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ids.authOne}',false);`);
const visible = await query("select title from public.cookbook_asset order by title");
assert.deepEqual(visible.rows, [{ title: "Tenant one page" }]);
const mutablePrivileges = await query(`
  select privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'cookbook_asset'
    and grantee = 'authenticated'
  order by privilege_type
`);
assert.deepEqual(mutablePrivileges.rows, [
  { privilege_type: 'DELETE' },
  { privilege_type: 'INSERT' },
  { privilege_type: 'SELECT' },
  { privilege_type: 'UPDATE' },
]);
const immutablePrivileges = await query(`
  select privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'cookbook_asset_version'
    and grantee = 'authenticated'
  order by privilege_type
`);
assert.deepEqual(immutablePrivileges.rows, [
  { privilege_type: 'INSERT' },
  { privilege_type: 'SELECT' },
]);
await exec("reset role");

console.log("Cookbook Asset Studio PGlite behavioral checks passed");
await db.close();
