-- pgTAP behavioral tests for exact protected-version synchronization.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'boh_vault_deployment_adapters', 'adapter registry exists');
select has_table('public', 'boh_vault_deployment_targets', 'deployment targets exist');
select has_table('public', 'boh_vault_sync_bindings', 'sync bindings exist');
select has_table('public', 'boh_vault_sync_runs', 'sync runs exist');
select has_column('public', 'boh_vault_sync_bindings', 'item_field_id', 'bindings identify the exact item field');
select has_column('public', 'boh_vault_sync_bindings', 'last_synced_secret_version_id', 'bindings retain the exact synchronized version id');
select hasnt_column('public', 'boh_vault_sync_bindings', 'last_synced_version', 'ambiguous integer sync marker is absent');
select has_column('public', 'boh_vault_sync_runs', 'vault_item_id', 'runs retain the exact item id');
select has_column('public', 'boh_vault_sync_runs', 'item_field_id', 'runs retain the exact field id');
select has_column('public', 'boh_vault_sync_runs', 'secret_version_id', 'runs retain the exact version id');
select ok(not exists (
  select 1 from pg_constraint c
  where c.conrelid = 'public.boh_vault_deployment_adapters'::regclass and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ~* '(cloudflare|supabase|aws|azure|openai|openrouter|gemini|zai)'
), 'adapter keys remain provider-neutral data');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_sync_bindings_exact_protected_field_fk'),
  'binding field relation is tenant/item exact');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_sync_bindings_last_version_fk'),
  'binding last-synced marker is an exact composite version relation');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_sync_runs_exact_binding_fk'),
  'run item and field must match its binding');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_sync_runs_exact_version_fk'),
  'run version must match its item and field');

select ok(not has_table_privilege('authenticated', 'public.boh_vault_deployment_targets', 'insert'), 'browser cannot create targets directly');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_sync_bindings', 'insert'), 'browser cannot create bindings directly');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_sync_runs', 'insert'), 'browser cannot create runs directly');
select ok(not has_table_privilege('service_role', 'public.boh_vault_deployment_targets', 'insert'), 'service role cannot create targets directly');
select ok(not has_table_privilege('service_role', 'public.boh_vault_sync_bindings', 'update'), 'service role cannot mutate bindings directly');
select ok(not has_table_privilege('service_role', 'public.boh_vault_sync_runs', 'update'), 'service role cannot mutate runs directly');
select ok(has_function_privilege('service_role',
  'public.boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text)', 'execute'),
  'service role may request a run through the narrow RPC');
select ok(has_function_privilege('service_role',
  'public.boh_vault_start_sync_run(uuid,uuid,uuid,text,text)', 'execute')
  and has_function_privilege('service_role',
    'public.boh_vault_complete_sync_run(uuid,uuid,text,uuid,text,text)', 'execute')
  and has_function_privilege('service_role',
    'public.boh_vault_fail_sync_run(uuid,uuid,text,uuid,text,text)', 'execute')
  and has_function_privilege('service_role',
    'public.boh_vault_cancel_sync_run(uuid,uuid,uuid,text,text)', 'execute'),
  'service role has the narrow run lifecycle RPCs');
select ok(not has_function_privilege('authenticated',
  'public.boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text)', 'execute'),
  'browser cannot request a run RPC');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name in ('boh_vault_deployment_targets_safe','boh_vault_sync_bindings_safe','boh_vault_sync_runs_safe')
    and column_name in ('plaintext_value','raw_value','secret_value','ciphertext','nonce','wrapped_key','wrapped_data_key','request_body','response_body')
), 'safe sync views expose no secrets, cryptographic material, or raw payloads');

create temporary table _vault_sync_fixture as
select tenant.id tenant_id, member.user_id user_id,
  gen_random_uuid() item_id, gen_random_uuid() other_item_id,
  gen_random_uuid() protected_field_id, gen_random_uuid() other_field_id,
  gen_random_uuid() plaintext_field_id, gen_random_uuid() key_id,
  gen_random_uuid() version_id, gen_random_uuid() other_version_id,
  gen_random_uuid() adapter_id
from public.boh_tenant tenant
join public.boh_tenant_member member on member.tenant_id = tenant.id and member.membership_status = 'active'
join public.boh_user user_row on user_row.id = member.user_id
  and user_row.tenant_id = tenant.id and user_row.status = 'active' and user_row.app_context = 'boh'
where tenant.status = 'active'
limit 1;
select ok((select count(*) = 1 from _vault_sync_fixture), 'active tenant/member sync fixture is available');

insert into public.boh_tenant_app(tenant_id, app_id, status, app_kind, display_name, launch_route)
select fixture.tenant_id, app.id, 'enabled', 'boh', 'Vault', '/vault'
from _vault_sync_fixture fixture join public.boh_app app on app.slug = 'vault'
on conflict (tenant_id, app_id) do update set status = 'enabled';
delete from public.boh_vault_access_grants grant_row using _vault_sync_fixture fixture
where grant_row.tenant_id = fixture.tenant_id and grant_row.boh_user_id = fixture.user_id;
insert into public.boh_vault_access_grants(tenant_id, boh_user_id, role, environment, status, granted_by)
select tenant_id, user_id, 'vault_admin', 'development', 'active', user_id from _vault_sync_fixture;

insert into public.boh_vault_items(id, tenant_id, item_key, display_name, environment, created_by)
select item_id, tenant_id, 'pgtap-sync-item', 'pgTAP sync item', 'development', user_id from _vault_sync_fixture
union all
select other_item_id, tenant_id, 'pgtap-sync-other', 'pgTAP sync other', 'development', user_id from _vault_sync_fixture;
insert into public.boh_vault_item_fields(id, tenant_id, vault_item_id, field_key, label, field_kind, plaintext_value, created_by)
select protected_field_id, tenant_id, item_id, 'password', 'Password', 'protected', null, user_id from _vault_sync_fixture
union all
select plaintext_field_id, tenant_id, item_id, 'endpoint', 'Endpoint', 'plaintext', 'https://example.test', user_id from _vault_sync_fixture
union all
select other_field_id, tenant_id, other_item_id, 'token', 'Token', 'protected', null, user_id from _vault_sync_fixture;
insert into public.boh_vault_tenant_keys(id, tenant_id, key_version, wrapping_key_ref, wrapped_key, algorithm, state, activated_at, created_by)
select key_id, tenant_id, 999992, 'pgtap-sync-kms-key', 'wrapped-key-material', 'AES-256-GCM', 'active', transaction_timestamp(), user_id
from _vault_sync_fixture;
insert into public.boh_vault_secret_versions(
  id, tenant_id, vault_item_id, item_field_id, tenant_key_id, version,
  ciphertext, nonce, wrapped_data_key, algorithm, state, created_by, activated_at
)
select version_id, tenant_id, item_id, protected_field_id, key_id, 1,
  'ciphertext-one', 'nonce-one', 'wrapped-data-key-one', 'AES-256-GCM', 'active', user_id, transaction_timestamp()
from _vault_sync_fixture
union all
select other_version_id, tenant_id, other_item_id, other_field_id, key_id, 1,
  'ciphertext-two', 'nonce-two', 'wrapped-data-key-two', 'AES-256-GCM', 'active', user_id, transaction_timestamp()
from _vault_sync_fixture;
insert into public.boh_vault_deployment_adapters(id, adapter_key, display_name)
select adapter_id, 'pgtap-provider-neutral-adapter', 'pgTAP provider-neutral adapter' from _vault_sync_fixture;

select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok($$
  select public.boh_vault_create_sync_binding(
    fixture.tenant_id, fixture.item_id, gen_random_uuid(), gen_random_uuid(),
    'development', 'MISSING', 'runtime_secret_sync', fixture.user_id,
    'pgtap-sync-service', 'pgtap-missing-binding'
  ) from _vault_sync_fixture fixture
$$, '23503', null, 'a nonexistent field/target binding is rejected');

create temporary table _vault_sync_ids(
  target_id uuid, binding_id uuid, run_id uuid, cancelled_run_id uuid, failed_run_id uuid
);
insert into _vault_sync_ids(target_id)
select public.boh_vault_create_deployment_target(
  fixture.tenant_id, fixture.adapter_id, 'pgtap-target', 'pgTAP target', 'development',
  'provider-neutral-ref', fixture.user_id, 'pgtap-sync-service', 'pgtap-target-create',
  '{"adapter_option":"opaque-data"}'::jsonb
) from _vault_sync_fixture fixture;
select lives_ok($$
  select public.boh_vault_update_deployment_target(
    fixture.tenant_id, ids.target_id, 'pgTAP target updated', 'provider-neutral-ref-2',
    'active', transaction_timestamp(), '{"adapter_option":"still-opaque"}'::jsonb,
    fixture.user_id, 'pgtap-sync-service', 'pgtap-target-update'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'deployment target updates only through the audited RPC');

select throws_ok($$
  select public.boh_vault_create_sync_binding(
    fixture.tenant_id, fixture.item_id, fixture.plaintext_field_id, ids.target_id,
    'development', 'PLAINTEXT_DEST', 'runtime_secret_sync', fixture.user_id,
    'pgtap-sync-service', 'pgtap-plaintext-binding'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, '23514', null, 'a plaintext field cannot be bound for protected synchronization');
select throws_ok($$
  select public.boh_vault_create_sync_binding(
    fixture.tenant_id, fixture.item_id, fixture.other_field_id, ids.target_id,
    'development', 'WRONG_FIELD_DEST', 'runtime_secret_sync', fixture.user_id,
    'pgtap-sync-service', 'pgtap-wrong-field-binding'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, '23503', null, 'a protected field from another item cannot be bound');

update _vault_sync_ids ids set binding_id = created.binding_id
from (
  select public.boh_vault_create_sync_binding(
    fixture.tenant_id, fixture.item_id, fixture.protected_field_id, ids2.target_id,
    'development', 'DESTINATION_KEY', 'runtime_secret_sync', fixture.user_id,
    'pgtap-sync-service', 'pgtap-binding-create'
  ) binding_id
  from _vault_sync_fixture fixture cross join _vault_sync_ids ids2
) created;
select lives_ok($$
  select public.boh_vault_update_sync_binding(
    fixture.tenant_id, ids.binding_id, 'ready', fixture.user_id,
    'pgtap-sync-service', 'pgtap-binding-ready'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'the binding state is updated only through its audited RPC');

select throws_ok($$
  select public.boh_vault_request_sync_run(
    fixture.tenant_id, ids.binding_id, fixture.other_version_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-wrong-version', 'pgtap-wrong-version-run'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, '23503', null, 'a version for another item/field cannot be requested');
select throws_ok($$
  select public.boh_vault_request_sync_run(
    fixture.tenant_id, ids.binding_id, gen_random_uuid(), fixture.user_id,
    'pgtap-sync-service', 'pgtap-missing-version', 'pgtap-missing-version-run'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, '23503', null, 'a nonexistent version cannot be requested');

update _vault_sync_ids ids set run_id = requested.run_id
from (
  select public.boh_vault_request_sync_run(
    fixture.tenant_id, ids2.binding_id, fixture.version_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-sync-run', 'pgtap-sync-request'
  ) run_id
  from _vault_sync_fixture fixture cross join _vault_sync_ids ids2
) requested;
select lives_ok($$
  select public.boh_vault_start_sync_run(
    fixture.tenant_id, ids.run_id, fixture.user_id, 'pgtap-sync-service', 'pgtap-sync-start'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'queued run starts through the narrow RPC');
select throws_ok($$
  update public.boh_vault_sync_runs set completed_at = transaction_timestamp()
  where id = (select run_id from _vault_sync_ids)
$$, '55000', null, 'lifecycle timestamps cannot change outside an exact transition');
select lives_ok($$
  select public.boh_vault_complete_sync_run(
    fixture.tenant_id, ids.run_id, 'ok', fixture.user_id,
    'pgtap-sync-service', 'pgtap-sync-complete'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'running run completes through the narrow RPC');
select is((select status from public.boh_vault_sync_runs where id = (select run_id from _vault_sync_ids)),
  'succeeded', 'intended run lifecycle reaches succeeded');
select is((select binding.last_synced_secret_version_id
  from public.boh_vault_sync_bindings binding join _vault_sync_ids ids on ids.binding_id = binding.id),
  (select version_id from _vault_sync_fixture), 'completion records the exact synchronized secret-version id');
select is((select count(*)::integer from public.boh_vault_audit_events event
  where event.request_id in ('pgtap-sync-request','pgtap-sync-start','pgtap-sync-complete')
    and event.event_type in ('sync_requested','sync_started','sync_completed')), 3,
  'request, start, and completion append their audit events atomically');
select ok(not exists (
  select 1 from public.boh_vault_audit_events event
  where event.request_id in ('pgtap-sync-request','pgtap-sync-start','pgtap-sync-complete')
    and public.boh_vault_json_has_protected_key(event.metadata)
), 'sync audit metadata contains identifiers and outcomes but no protected material');

update _vault_sync_ids ids set cancelled_run_id = requested.run_id
from (
  select public.boh_vault_request_sync_run(
    fixture.tenant_id, ids2.binding_id, fixture.version_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-cancel-request', 'pgtap-cancel-run'
  ) run_id
  from _vault_sync_fixture fixture cross join _vault_sync_ids ids2
) requested;
select lives_ok($$
  select public.boh_vault_cancel_sync_run(
    fixture.tenant_id, ids.cancelled_run_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-sync-cancel'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'queued run can be cancelled only through the narrow RPC');

update _vault_sync_ids ids set failed_run_id = requested.run_id
from (
  select public.boh_vault_request_sync_run(
    fixture.tenant_id, ids2.binding_id, fixture.version_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-fail-request', 'pgtap-fail-run'
  ) run_id
  from _vault_sync_fixture fixture cross join _vault_sync_ids ids2
) requested;
select lives_ok($$
  select public.boh_vault_start_sync_run(
    fixture.tenant_id, ids.failed_run_id, fixture.user_id,
    'pgtap-sync-service', 'pgtap-fail-start'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'a second queued run starts through the narrow RPC');
select lives_ok($$
  select public.boh_vault_fail_sync_run(
    fixture.tenant_id, ids.failed_run_id, 'adapter_error', fixture.user_id,
    'pgtap-sync-service', 'pgtap-sync-fail'
  ) from _vault_sync_fixture fixture cross join _vault_sync_ids ids
$$, 'running run fails through the narrow RPC');
select is((select count(*)::integer from public.boh_vault_audit_events event
  where event.request_id in ('pgtap-sync-cancel','pgtap-sync-fail')
    and event.event_type in ('sync_cancelled','sync_failed')), 2,
  'cancel and failure append their lifecycle audit events atomically');
select is((select count(*)::integer from public.boh_vault_audit_events event
  where event.request_id in ('pgtap-target-create','pgtap-binding-create','pgtap-binding-ready')
    and event.event_type in ('deployment_target_created','sync_binding_created','sync_binding_updated')), 3,
  'target and binding creation/update are audited');

select throws_ok($$
  update public.boh_vault_sync_runs set result_code = 'tampered'
  where id = (select run_id from _vault_sync_ids)
$$, '55000', null, 'terminal lifecycle results are immutable');
set local role service_role;
select throws_ok($$
  insert into public.boh_vault_sync_runs(
    tenant_id,binding_id,vault_item_id,item_field_id,secret_version_id,environment,
    request_id,service_identity,requested_by
  ) values (
    gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),
    'development','direct-service-run','pgtap',gen_random_uuid()
  )
$$, '42501', null, 'service-role direct run DML is unavailable');
reset role;

select * from finish();
rollback;
