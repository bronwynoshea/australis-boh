-- pgTAP behavioral and contract tests for the BOH Vault core.
-- Run against an isolated/local database after migrations; every fixture rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'boh_vault_access_grants', 'access grants exist');
select has_table('public', 'boh_vault_collections', 'collections exist');
select has_table('public', 'boh_vault_items', 'items exist');
select has_table('public', 'boh_vault_item_fields', 'item fields exist');
select has_table('public', 'boh_vault_tenant_keys', 'tenant keys exist');
select has_table('public', 'boh_vault_secret_versions', 'secret versions exist');
select has_table('public', 'boh_vault_audit_events', 'audit events exist');
select has_view('public', 'boh_vault_items_safe', 'safe item view exists');
select has_view('public', 'boh_vault_item_fields_safe', 'safe field view exists');
select has_view('public', 'boh_vault_collections_safe', 'safe collection view exists');
select has_view('public', 'boh_vault_collection_items_safe', 'safe collection-membership view exists');
select has_view('public', 'boh_vault_audit_events_safe', 'safe audit view exists');
select has_column('public', 'boh_vault_items', 'notes', 'ordinary plaintext notes remain supported');
select ok(not exists (
  select 1 from pg_constraint c
  where c.conrelid = 'public.boh_vault_items'::regclass
    and pg_get_constraintdef(c.oid) ~ 'secure_note'
), 'secure_note is not a Vault item type');

-- Scalar-safe recursion plus snake_case/camelCase, authorization, credential, and
-- Bearer detection. These execute the real immutable helper rather than inspecting text.
select is(public.boh_vault_json_has_protected_key('42'::jsonb), false, 'scalar number is safe and does not raise');
select is(public.boh_vault_json_has_protected_key('null'::jsonb), false, 'JSON null is safe and does not raise');
select is(public.boh_vault_json_has_protected_key('{"nested":[{"displayName":"ordinary"}]}'::jsonb), false, 'ordinary nested JSON is allowed');
select is(public.boh_vault_json_has_protected_key('{"apiKey":"redacted"}'::jsonb), true, 'camelCase apiKey is rejected');
select is(public.boh_vault_json_has_protected_key('{"authorization":"redacted"}'::jsonb), true, 'authorization keys are rejected');
select is(public.boh_vault_json_has_protected_key('{"credentialRef":"safe-looking"}'::jsonb), true, 'credential-bearing keys are rejected');
select is(public.boh_vault_json_has_protected_key('{"nested":["Bearer abc.def.ghi"]}'::jsonb), true, 'Bearer values are rejected recursively');
select is(public.boh_vault_json_has_protected_key('{"wrappedDataKey":"redacted"}'::jsonb), true, 'camelCase cryptographic keys are rejected');
select is(public.boh_vault_json_has_protected_key('{"signingKey":"redacted"}'::jsonb), true, 'camelCase signingKey is rejected');

select is(public.boh_vault_plaintext_is_safe('website', 'Website', 'https://example.test'), true, 'ordinary plaintext field is allowed');
select is(public.boh_vault_plaintext_is_safe('notes', 'Notes', 'Call the account owner'), true, 'ordinary notes remain plaintext-safe');
select is(public.boh_vault_plaintext_is_safe('authorization', 'Header', 'redacted'), false, 'authorization plaintext fields are rejected');
select is(public.boh_vault_plaintext_is_safe('header', 'Header', 'Bearer abc.def.ghi'), false, 'Bearer plaintext values are rejected');

select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_secret_versions_exact_field_fk'),
  'secret version field must belong to the exact item and tenant');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_items_owner_fk'),
  'item owner is tenant-consistent');
select ok(exists (select 1 from pg_constraint where conname = 'boh_vault_audit_events_actor_fk'),
  'audit actor is tenant-consistent');
select ok(exists (select 1 from pg_indexes where indexname = 'boh_vault_collections_root_name_uidx'),
  'root collection names are uniquely constrained despite NULL parent IDs');
select ok(exists (select 1 from pg_trigger where tgname = 'boh_vault_tenant_keys_guard' and not tgisinternal),
  'tenant-key payload/state guard exists');
select ok(exists (select 1 from pg_trigger where tgname = 'boh_vault_secret_versions_guard' and not tgisinternal),
  'secret-version payload/state guard exists');
select ok(exists (select 1 from pg_trigger where tgname = 'boh_vault_audit_events_append_only' and not tgisinternal),
  'audit is append-only');
select ok(exists (select 1 from pg_trigger where tgname = 'boh_vault_audit_events_safe_metadata' and not tgisinternal),
  'audit JSON is recursively screened');

select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name in ('boh_vault_items_safe','boh_vault_item_fields_safe')
    and column_name in ('ciphertext','nonce','wrapped_key','wrapped_data_key','raw_value')
), 'safe views expose no cryptographic or protected material columns');
select has_column('public','boh_vault_item_fields_safe','plaintext_value',
  'safe field view retains the intentional conditional plaintext column');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_tenant_keys', 'select'), 'browser cannot read tenant keys');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_secret_versions', 'select'), 'browser cannot read secret versions');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_items', 'insert'), 'browser cannot write Vault items');
select ok(not has_table_privilege('authenticated', 'public.boh_vault_audit_events', 'insert'), 'browser cannot forge audit');
select ok(not has_table_privilege('service_role', 'public.boh_vault_items', 'insert'), 'service role cannot bypass audited item RPCs');
select ok(not has_table_privilege('service_role', 'public.boh_vault_item_fields', 'update'), 'service role cannot bypass audited field RPCs');
select ok(not has_table_privilege('service_role', 'public.boh_vault_collections', 'delete'), 'service role cannot bypass audited collection RPCs');
select ok(not has_table_privilege('service_role', 'public.boh_vault_access_grants', 'insert'), 'service role cannot bypass audited grant RPCs');
select ok(has_function_privilege('service_role',
  'public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)', 'execute'),
  'service role may execute the atomic secret commit');
select ok(not has_function_privilege('authenticated',
  'public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)', 'execute'),
  'browser cannot execute the protected secret commit');
select ok(has_function_privilege('service_role',
  'public.boh_vault_upsert_collection(uuid,uuid,text,uuid,text,text,text,uuid,text,text)', 'execute'),
  'service role may execute an audited collection mutation');
select ok(not has_function_privilege('authenticated',
  'public.boh_vault_upsert_collection(uuid,uuid,text,uuid,text,text,text,uuid,text,text)', 'execute'),
  'normal user JWTs cannot call service mutation RPCs');

-- Build one real tenant/item/field/key fixture from an active BOH member.
create temporary table _vault_core_fixture as
select tenant.id tenant_id, member.user_id user_id, user_row.auth_user_id,
  gen_random_uuid() item_one, gen_random_uuid() item_two,
  gen_random_uuid() field_one, gen_random_uuid() field_two,
  gen_random_uuid() field_required_two, gen_random_uuid() field_plain_required,
  gen_random_uuid() key_id, gen_random_uuid() dev_collection, gen_random_uuid() prod_collection,
  gen_random_uuid() membership_id
from public.boh_tenant tenant
join public.boh_tenant_member member on member.tenant_id = tenant.id and member.membership_status = 'active'
join public.boh_user user_row on user_row.id = member.user_id and user_row.status = 'active' and user_row.app_context = 'boh'
where tenant.status = 'active'
limit 1;
select ok((select count(*) = 1 from _vault_core_fixture), 'an active tenant/member fixture is available');

insert into public.boh_tenant_app(tenant_id,app_id,status,app_kind)
select tenant_id, app.id, 'enabled', 'boh' from _vault_core_fixture cross join public.boh_app app where app.slug='vault'
on conflict (tenant_id,app_id) do update set status='enabled';
insert into public.boh_vault_access_grants(tenant_id,boh_user_id,role,environment,status,granted_by)
select tenant_id,user_id,'vault_admin','development','active',user_id from _vault_core_fixture fixture
where not exists (select 1 from public.boh_vault_access_grants grant_row
  where grant_row.tenant_id=fixture.tenant_id and grant_row.boh_user_id=fixture.user_id
    and grant_row.role='vault_admin' and grant_row.environment='development' and grant_row.status='active');

insert into public.boh_vault_items(id, tenant_id, item_key, display_name, environment, created_by)
select item_one, tenant_id, 'pgtap-core-one', 'pgTAP core one', 'development', user_id from _vault_core_fixture
union all
select item_two, tenant_id, 'pgtap-core-two', 'pgTAP core two', 'development', user_id from _vault_core_fixture;
insert into public.boh_vault_item_fields(id, tenant_id, vault_item_id, field_key, label, field_kind, plaintext_value, is_required, created_by)
select field_one, tenant_id, item_one, 'password', 'Password', 'protected', null, true, user_id from _vault_core_fixture
union all
select field_two, tenant_id, item_two, 'token', 'Token', 'protected', null, false, user_id from _vault_core_fixture
union all
select field_required_two, tenant_id, item_one, 'client_certificate', 'Client certificate', 'protected', null, true, user_id from _vault_core_fixture
union all
select field_plain_required, tenant_id, item_one, 'account_name', 'Account name', 'plaintext', '   ', true, user_id from _vault_core_fixture;
insert into public.boh_vault_tenant_keys(id, tenant_id, key_version, wrapping_key_ref, wrapped_key, algorithm, state, activated_at, created_by)
select key_id, tenant_id, 999991, 'pgtap-kms-key', 'wrapped-key-material', 'AES-256-GCM', 'active', transaction_timestamp(), user_id
from _vault_core_fixture;

select throws_ok($$
  insert into public.boh_vault_secret_versions(
    tenant_id, vault_item_id, item_field_id, tenant_key_id, version,
    ciphertext, nonce, wrapped_data_key, algorithm, state, created_by, activated_at
  ) select tenant_id, item_one, field_two, key_id, 1,
      'ciphertext', 'nonce', 'wrapped-data-key', 'AES-256-GCM', 'active', user_id, transaction_timestamp()
    from _vault_core_fixture
$$, '23503', null, 'a field from another item cannot be attached to a secret version');

insert into public.boh_vault_secret_versions(
  tenant_id, vault_item_id, item_field_id, tenant_key_id, version,
  ciphertext, nonce, wrapped_data_key, algorithm, state, created_by, activated_at
) select tenant_id, item_two, field_two, key_id, 1,
    'ciphertext', 'nonce', 'wrapped-data-key', 'AES-256-GCM', 'active', user_id, transaction_timestamp()
  from _vault_core_fixture;

select throws_ok($$
  update public.boh_vault_secret_versions set ciphertext = 'tampered'
  where id = (select id from public.boh_vault_secret_versions where item_field_id = (select field_two from _vault_core_fixture))
$$, '55000', null, 'cryptographic payload is immutable');
select throws_ok($$
  update public.boh_vault_secret_versions set state = 'pending'
  where id = (select id from public.boh_vault_secret_versions where item_field_id = (select field_two from _vault_core_fixture))
$$, '22023', null, 'secret state cannot transition backward');
select throws_ok($$
  delete from public.boh_vault_secret_versions
  where item_field_id = (select field_two from _vault_core_fixture)
$$, '55000', null, 'secret versions cannot be deleted');
select throws_ok($$
  update public.boh_vault_secret_versions set activated_at = transaction_timestamp() + interval '1 second'
  where item_field_id = (select field_two from _vault_core_fixture)
$$, '55000', null, 'same-state updates cannot rewrite activation history');
select lives_ok($$
  update public.boh_vault_secret_versions set state = 'superseded', superseded_at = transaction_timestamp()
  where item_field_id = (select field_two from _vault_core_fixture)
$$, 'active secret can transition to superseded with the exact timestamp delta');
select throws_ok($$
  update public.boh_vault_secret_versions set superseded_at = transaction_timestamp() + interval '1 second'
  where item_field_id = (select field_two from _vault_core_fixture)
$$, '55000', null, 'terminal secret lifecycle history is immutable');
select throws_ok($$
  update public.boh_vault_tenant_keys set wrapped_key = 'tampered'
  where id = (select key_id from _vault_core_fixture)
$$, '55000', null, 'wrapped tenant-key payload is immutable');
select throws_ok($$
  update public.boh_vault_tenant_keys set activated_at = transaction_timestamp() + interval '1 second'
  where id = (select key_id from _vault_core_fixture)
$$, '55000', null, 'same-state key updates cannot rewrite activation history');
select throws_ok($$
  delete from public.boh_vault_tenant_keys where id = (select key_id from _vault_core_fixture)
$$, '55000', null, 'tenant keys cannot be deleted');

-- Audited collection RPC plus exact environment relationships and safe-view isolation.
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($$
  select public.boh_vault_upsert_collection(dev_collection,tenant_id,'development',null,
    'Development collection',null,'active',user_id,'pgtap-collection-create','pgtap')
  from _vault_core_fixture
$$, 'service collection mutation succeeds through the audited RPC');
select is((select count(*)::integer from public.boh_vault_audit_events
  where request_id='pgtap-collection-create' and event_type='collection_created'),1,
  'collection RPC appends its audit event atomically');
insert into public.boh_vault_collections(id,tenant_id,environment,name,created_by)
select prod_collection,tenant_id,'production','Production collection',user_id from _vault_core_fixture;
insert into public.boh_vault_collection_items(id,tenant_id,environment,collection_id,vault_item_id,added_by)
select membership_id,tenant_id,'development',dev_collection,item_one,user_id from _vault_core_fixture;
select throws_ok($$
  insert into public.boh_vault_collection_items(tenant_id,environment,collection_id,vault_item_id,added_by)
  select tenant_id,'production',prod_collection,item_one,user_id from _vault_core_fixture
$$, '23503', null, 'collection membership requires an item in the exact same environment');
select throws_ok($$
  update public.boh_vault_collections set parent_collection_id=(select dev_collection from _vault_core_fixture)
  where id=(select prod_collection from _vault_core_fixture)
$$, '23503', null, 'collection parents must be in the exact same environment');
select set_config('request.jwt.claim.sub',(select auth_user_id::text from _vault_core_fixture),true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select count(*)::integer from public.boh_vault_collections_safe
  where id in ((select dev_collection from _vault_core_fixture),(select prod_collection from _vault_core_fixture))),1,
  'an environment-scoped user sees only the development collection');
select is((select count(*)::integer from public.boh_vault_collection_items_safe
  where id=(select membership_id from _vault_core_fixture)),1,
  'an environment-scoped user can read matching collection membership');
select is((select plaintext_value from public.boh_vault_item_fields_safe
  where id=(select field_one from _vault_core_fixture)),null::text,
  'protected fields return NULL through the conditional plaintext column');

-- Readiness spans every required protected and plaintext field; rotation time is
-- assigned only when an existing active version is actually superseded.
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($$
  select public.boh_vault_commit_secret_version(tenant_id,item_one,field_one,key_id,user_id,
    'cipher-one','nonce-one','wrapped-one','pgtap-commit-one','pgtap') from _vault_core_fixture
$$, 'first required protected value commits');
select is((select value_state from public.boh_vault_items where id=(select item_one from _vault_core_fixture)),
  'needs_setup','one partial required value leaves the item needing setup');
select is((select last_rotated_at from public.boh_vault_items where id=(select item_one from _vault_core_fixture)),
  null::timestamptz,'an initial commit is not a rotation');
select lives_ok($$
  select public.boh_vault_commit_secret_version(tenant_id,item_one,field_required_two,key_id,user_id,
    'cipher-two','nonce-two','wrapped-two','pgtap-commit-two','pgtap') from _vault_core_fixture
$$, 'second required protected value commits');
select is((select value_state from public.boh_vault_items where id=(select item_one from _vault_core_fixture)),
  'needs_setup','blank required plaintext still leaves the item needing setup');
update public.boh_vault_item_fields set plaintext_value='Account A'
where id=(select field_plain_required from _vault_core_fixture);
select lives_ok($$
  select public.boh_vault_commit_secret_version(tenant_id,item_one,field_one,key_id,user_id,
    'cipher-three','nonce-three','wrapped-three','pgtap-rotate-one','pgtap') from _vault_core_fixture
$$, 'rotating a required value recomputes complete readiness');
select is((select value_state from public.boh_vault_items where id=(select item_one from _vault_core_fixture)),
  'configured','all required protected and plaintext fields configure the item');
select ok((select last_rotated_at is not null from public.boh_vault_items where id=(select item_one from _vault_core_fixture)),
  'rotation timestamp changes only after a previous active version is superseded');
select is((select count(*)::integer from public.boh_vault_audit_events
  where request_id='pgtap-rotate-one' and event_type in ('secret_version_committed','secret_version_superseded','rotated')),
  3,'rotation emits committed, superseded, and rotated events atomically');
select ok(exists(select 1 from public.boh_vault_audit_events where request_id='pgtap-rotate-one'
  and event_type='rotated' and metadata->>'prior_version'='1' and metadata->>'new_version'='2'),
  'rotation audit records both prior and new version numbers');

select lives_ok($$
  insert into public.boh_vault_audit_events(
    tenant_id, vault_item_id, service_identity, event_type, request_id, environment, subject_type, subject_id, metadata, created_at
  ) select tenant_id, item_one, 'pgtap', 'item_updated', 'pgtap-backdate', 'development', 'item', item_one, '{}'::jsonb,
      transaction_timestamp() - interval '1 day' from _vault_core_fixture
$$, 'a valid audit event has its caller timestamp replaced');
select is((select created_at from public.boh_vault_audit_events where request_id='pgtap-backdate'),
  transaction_timestamp(),'audit timestamps are server-assigned');

select * from finish();
rollback;
