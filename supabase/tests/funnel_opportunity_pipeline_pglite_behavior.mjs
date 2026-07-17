const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const exec = (sql) => db.exec(sql);
const query = (sql, params = []) => db.query(sql, params);

const ids = {
  tenantOne: '10000000-0000-0000-0000-000000000001',
  tenantTwo: '10000000-0000-0000-0000-000000000002',
  authOne: '20000000-0000-0000-0000-000000000001',
  authTwo: '20000000-0000-0000-0000-000000000002',
  userOne: '30000000-0000-0000-0000-000000000001',
  userTwo: '30000000-0000-0000-0000-000000000002',
  orgOne: '40000000-0000-0000-0000-000000000001',
  orgTwo: '40000000-0000-0000-0000-000000000002',
  personOne: '50000000-0000-0000-0000-000000000001',
  personTwo: '50000000-0000-0000-0000-000000000002',
};

await exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create schema private;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table public.boh_tenant(
    id uuid primary key,
    slug text unique not null,
    name text not null,
    status text not null,
    app_context text,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );
  create table public.boh_user(
    id uuid primary key,
    auth_user_id uuid,
    tenant_id uuid references public.boh_tenant(id),
    app_context text,
    status text,
    created_at timestamptz default now()
  );
  create table public.boh_tenant_member(
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.boh_tenant(id),
    user_id uuid references public.boh_user(id),
    membership_status text,
    is_default boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(tenant_id, user_id)
  );
  create table public.boh_app(
    id uuid primary key,
    name text,
    slug text unique,
    description text,
    route text,
    external_url text,
    primary_color text,
    type text,
    is_active boolean,
    app_context text,
    created_at timestamptz
  );
  create table public.boh_tenant_app(
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.boh_tenant(id),
    app_id uuid references public.boh_app(id),
    status text,
    app_kind text,
    display_name text,
    launch_route text,
    external_url text,
    metadata jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(tenant_id, app_id)
  );
  create table public.patron_person(
    id uuid primary key,
    tenant_id uuid not null references public.boh_tenant(id),
    first_name text,
    last_name text
  );
  create table public.patron_organisation(
    id uuid primary key,
    tenant_id uuid not null references public.boh_tenant(id),
    name text not null
  );
  create function private.current_boh_user_id() returns uuid
  language sql stable security definer set search_path = public, auth as $$
    select id from public.boh_user where auth_user_id = auth.uid() limit 1
  $$;

  insert into auth.users values
    ('${ids.authOne}', 'one@example.test'),
    ('${ids.authTwo}', 'two@example.test');
  insert into public.boh_tenant(id, slug, name, status) values
    ('${ids.tenantOne}', 'one', 'One', 'active'),
    ('${ids.tenantTwo}', 'two', 'Two', 'active');
  insert into public.boh_user(id, auth_user_id, tenant_id, app_context, status) values
    ('${ids.userOne}', '${ids.authOne}', '${ids.tenantOne}', 'boh', 'active'),
    ('${ids.userTwo}', '${ids.authTwo}', '${ids.tenantTwo}', 'boh', 'active');
  insert into public.boh_tenant_member(tenant_id, user_id, membership_status, is_default) values
    ('${ids.tenantOne}', '${ids.userOne}', 'active', true),
    ('${ids.tenantTwo}', '${ids.userTwo}', 'active', true);
  insert into public.patron_organisation(id, tenant_id, name) values
    ('${ids.orgOne}', '${ids.tenantOne}', 'Example Organisation'),
    ('${ids.orgTwo}', '${ids.tenantTwo}', 'Other Organisation');
  insert into public.patron_person(id, tenant_id, first_name, last_name) values
    ('${ids.personOne}', '${ids.tenantOne}', 'Tenant', 'One'),
    ('${ids.personTwo}', '${ids.tenantTwo}', 'Tenant', 'Two');
`);

const migration = await readFile(
  new URL('../migrations/20260717140000_create_funnel_opportunity_pipeline.sql', import.meta.url),
  'utf8',
);
await exec(migration);

const hardening = await readFile(
  new URL('../migrations/20260717140500_harden_funnel_stage_history.sql', import.meta.url),
  'utf8',
);
await exec(hardening);

const privilegeHardening = await readFile(
  new URL('../migrations/20260717140600_restrict_funnel_history_privileges.sql', import.meta.url),
  'utf8',
);
await exec(privilegeHardening);

const tablePrivilegeHardening = await readFile(
  new URL('../migrations/20260717140700_restrict_funnel_table_privileges.sql', import.meta.url),
  'utf8',
);
await exec(tablePrivilegeHardening);

const tenantReferenceHardening = await readFile(
  new URL('../migrations/20260717141500_enforce_funnel_tenant_references.sql', import.meta.url),
  'utf8',
);
await exec(tenantReferenceHardening);

await exec(`
  insert into public.boh_tenant_app(tenant_id, app_id, status, app_kind)
  select tenant.id, app.id, 'enabled', 'boh'
  from public.boh_tenant tenant
  cross join public.boh_app app
  where app.slug = 'funnel';
`);

let result = await query(`
  select label, default_probability::float8 as probability, stage_type
  from public.funnel_opportunity_stage
  where tenant_id = '${ids.tenantOne}'
  order by sort_order
`);
assert.deepEqual(
  result.rows.map(({ label, probability, stage_type }) => [label, probability, stage_type]),
  [
    ['Lead Identified', 2, 'open'],
    ['Qualified Lead', 10, 'open'],
    ['Discovery Complete', 20, 'open'],
    ['Solution Fit Validated', 35, 'open'],
    ['Demonstration / Proof of Concept', 50, 'open'],
    ['Proposal Submitted', 65, 'open'],
    ['Negotiation', 80, 'open'],
    ['Verbal Commitment', 95, 'open'],
    ['Closed Won', 100, 'won'],
    ['Closed Lost', 0, 'lost'],
  ],
);

const funnel = await query(`select id from public.funnel where tenant_id = '${ids.tenantOne}' limit 1`);
const funnelId = funnel.rows[0].id;
const leadStage = await query(`select id from public.funnel_opportunity_stage where funnel_id = '${funnelId}' and stage_key = 'lead_identified'`);
const qualifiedStage = await query(`select id from public.funnel_opportunity_stage where funnel_id = '${funnelId}' and stage_key = 'qualified_lead'`);
const otherFunnel = await query(`select id from public.funnel where tenant_id = '${ids.tenantTwo}' limit 1`);
const otherFunnelId = otherFunnel.rows[0].id;
const otherLeadStage = await query(`select id from public.funnel_opportunity_stage where funnel_id = '${otherFunnelId}' and stage_key = 'lead_identified'`);

await exec(`
  insert into public.funnel_opportunity(
    tenant_id, funnel_id, stage_id, primary_organisation_id, name, value_amount, currency, owner_id, created_by
  ) values
    ('${ids.tenantOne}', '${funnelId}', '${leadStage.rows[0].id}', '${ids.orgOne}', 'First opportunity', 10000, 'AUD', '${ids.userOne}', '${ids.userOne}'),
    ('${ids.tenantOne}', '${funnelId}', '${leadStage.rows[0].id}', '${ids.orgOne}', 'Second opportunity', 20000, 'AUD', '${ids.userOne}', '${ids.userOne}');
`);

result = await query(`select count(*)::int as count from public.funnel_opportunity where primary_organisation_id = '${ids.orgOne}'`);
assert.equal(result.rows[0].count, 2, 'one Patron organisation can have multiple Opportunities');

const firstOpportunity = await query(`select id from public.funnel_opportunity where name = 'First opportunity'`);
await exec(`
  update public.funnel_opportunity
  set stage_id = '${qualifiedStage.rows[0].id}', next_action = 'Schedule discovery', updated_by = '${ids.userOne}'
  where id = '${firstOpportunity.rows[0].id}';
`);
result = await query(`
  select previous_stage_id, next_stage_id
  from public.funnel_opportunity_stage_history
  where opportunity_id = '${firstOpportunity.rows[0].id}'
  order by changed_at
`);
assert.equal(result.rows.length, 2, 'initial placement and movement are both reportable');
assert.equal(result.rows[1].previous_stage_id, leadStage.rows[0].id);
assert.equal(result.rows[1].next_stage_id, qualifiedStage.rows[0].id);

await assert.rejects(
  exec(`update public.funnel_opportunity set owner_id = '${ids.userTwo}' where id = '${firstOpportunity.rows[0].id}'`),
  /owner_id must reference an active member of the same tenant/,
  'actor references cannot cross tenant boundaries',
);
await assert.rejects(
  exec(`insert into public.funnel_opportunity_person(tenant_id, opportunity_id, person_id) values ('${ids.tenantOne}', '${firstOpportunity.rows[0].id}', '${ids.personTwo}')`),
  /Patron person must belong to the same tenant/,
  'Patron person links cannot cross tenant boundaries',
);
await assert.rejects(
  exec(`insert into public.funnel_opportunity_stage_history(tenant_id, opportunity_id, next_stage_id, probability_after) values ('${ids.tenantOne}', '${firstOpportunity.rows[0].id}', '${otherLeadStage.rows[0].id}', 2)`),
  /History stages must belong to the same tenant and Funnel/,
  'trigger-owned history still validates stage tenant consistency',
);

await exec(`
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ids.authOne}', false);
`);
result = await query(`select distinct tenant_id from public.funnel`);
assert.deepEqual(result.rows, [{ tenant_id: ids.tenantOne }], 'RLS hides other tenant Funnels');
result = await query(`select has_table_privilege('authenticated', 'public.funnel_opportunity_stage_history', 'insert') as can_insert`);
assert.equal(result.rows[0].can_insert, false, 'browser users cannot forge stage history');
result = await query(`
  select privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'funnel_opportunity_stage_history'
    and grantee = 'authenticated'
  order by privilege_type
`);
assert.deepEqual(result.rows, [{ privilege_type: 'SELECT' }], 'history exposes read-only privileges');
result = await query(`
  select privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'funnel_opportunity'
    and grantee = 'authenticated'
  order by privilege_type
`);
assert.deepEqual(
  result.rows,
  [
    { privilege_type: 'DELETE' },
    { privilege_type: 'INSERT' },
    { privilege_type: 'SELECT' },
    { privilege_type: 'UPDATE' },
  ],
  'mutable Funnel tables expose DML only',
);
await assert.rejects(
  exec(`insert into public.funnel(tenant_id, funnel_key, name) values ('${ids.tenantTwo}', 'cross_tenant_write', 'Cross-tenant write')`),
  /row-level security policy/,
  'authenticated users cannot insert Funnels for another tenant',
);
await exec('reset role');

await exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
await assert.rejects(
  query('select * from public.funnel'),
  /permission denied/,
  'anonymous users cannot read Funnel data',
);
await exec('reset role');

await exec(`
  delete from public.boh_tenant_app
  where tenant_id = '${ids.tenantOne}'
    and app_id = (select id from public.boh_app where slug = 'funnel');
  set role authenticated;
  select set_config('request.jwt.claim.sub', '${ids.authOne}', false);
`);
result = await query('select * from public.funnel');
assert.equal(result.rows.length, 0, 'missing Funnel entitlement hides tenant data');
await exec('reset role');

console.log('Funnel opportunity pipeline PGlite behavioral checks passed');
await db.close();
