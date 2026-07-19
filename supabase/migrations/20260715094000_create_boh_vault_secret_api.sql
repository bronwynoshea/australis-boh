-- Protected BOH Vault service API contracts.
-- These functions return encrypted envelopes only. Plaintext exists only inside the Edge
-- Function process after tenant, item, field, and actor authorization has succeeded.

create or replace function public.boh_vault_get_active_tenant_key(
  requested_tenant_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_service_identity text,
  requested_request_id text
)
returns table (
  tenant_key_id uuid,
  key_version integer,
  wrapping_key_ref text,
  wrapped_key text,
  algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if btrim(coalesce(requested_service_identity, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = '' then
    raise exception 'Service identity and request ID are required' using errcode = '22023';
  end if;
  if not public.boh_vault_user_has_role(
    requested_tenant_id,
    requested_actor_boh_user_id,
    array['vault_admin','vault_editor'],
    requested_environment
  ) then
    raise exception 'Actor is not an authorized Vault admin or editor' using errcode = '42501';
  end if;

  return query
  select key_row.id, key_row.key_version, key_row.wrapping_key_ref, key_row.wrapped_key, key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id = requested_tenant_id
    and key_row.state = 'active'
  order by key_row.key_version desc
  limit 1;

  if not found then
    raise exception 'No active Vault tenant key exists' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.boh_vault_read_secret_envelope(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_item_field_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_service_identity text,
  requested_request_id text,
  requested_audit_event text
)
returns table (
  secret_version_id uuid,
  secret_version integer,
  ciphertext text,
  nonce text,
  wrapped_data_key text,
  secret_algorithm text,
  tenant_key_id uuid,
  wrapping_key_ref text,
  wrapped_key text,
  tenant_key_algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  secret_row record;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if requested_audit_event not in ('revealed','copied') then
    raise exception 'Audit event must be revealed or copied' using errcode = '22023';
  end if;
  if btrim(coalesce(requested_service_identity, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = '' then
    raise exception 'Service identity and request ID are required' using errcode = '22023';
  end if;
  if not public.boh_vault_user_has_role(
    requested_tenant_id,
    requested_actor_boh_user_id,
    array['vault_admin','vault_editor'],
    requested_environment
  ) then
    raise exception 'Actor is not an authorized Vault admin or editor' using errcode = '42501';
  end if;

  select
    version_row.id as secret_version_id,
    version_row.version as secret_version,
    version_row.ciphertext,
    version_row.nonce,
    version_row.wrapped_data_key,
    version_row.algorithm as secret_algorithm,
    key_row.id as tenant_key_id,
    key_row.wrapping_key_ref,
    key_row.wrapped_key,
    key_row.algorithm as tenant_key_algorithm
  into secret_row
  from public.boh_vault_items item
  join public.boh_vault_item_fields field
    on field.tenant_id = item.tenant_id
   and field.vault_item_id = item.id
   and field.id = requested_item_field_id
   and field.field_kind = 'protected'
  join public.boh_vault_secret_versions version_row
    on version_row.tenant_id = field.tenant_id
   and version_row.vault_item_id = field.vault_item_id
   and version_row.item_field_id = field.id
   and version_row.state = 'active'
  join public.boh_vault_tenant_keys key_row
    on key_row.tenant_id = version_row.tenant_id
   and key_row.id = version_row.tenant_key_id
  where item.tenant_id = requested_tenant_id
    and item.id = requested_item_id
    and item.environment = requested_environment
    and item.value_state <> 'disabled'
  for share of item, field, version_row, key_row;

  if not found then
    raise exception 'No active protected Vault value exists for the exact field' using errcode = 'P0002';
  end if;

  perform public.boh_vault_append_audit_event(
    requested_tenant_id,
    requested_item_id,
    requested_actor_boh_user_id,
    requested_service_identity,
    requested_audit_event,
    requested_request_id,
    requested_environment,
    'secret_version',
    secret_row.secret_version_id,
    jsonb_build_object(
      'item_field_id', requested_item_field_id,
      'version', secret_row.secret_version
    )
  );

  return query select
    secret_row.secret_version_id,
    secret_row.secret_version,
    secret_row.ciphertext,
    secret_row.nonce,
    secret_row.wrapped_data_key,
    secret_row.secret_algorithm,
    secret_row.tenant_key_id,
    secret_row.wrapping_key_ref,
    secret_row.wrapped_key,
    secret_row.tenant_key_algorithm;
end;
$$;

create or replace function public.boh_vault_initialize_tenant_key(
  requested_tenant_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_wrapping_key_ref text,
  requested_wrapped_key text,
  requested_service_identity text,
  requested_request_id text
)
returns table (
  tenant_key_id uuid,
  key_version integer,
  wrapping_key_ref text,
  wrapped_key text,
  algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  created_key_id uuid;
  next_key_version integer;
begin
  perform public.boh_vault_require_service_actor(
    requested_tenant_id, requested_actor_boh_user_id, requested_environment
  );
  if btrim(coalesce(requested_wrapping_key_ref, '')) = ''
     or btrim(coalesce(requested_wrapped_key, '')) = ''
     or btrim(coalesce(requested_service_identity, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = '' then
    raise exception 'Wrapped key, service identity, and request ID are required' using errcode = '22023';
  end if;

  -- Serialize first-use initialization per tenant. A concurrent caller observes and
  -- returns the key created by the winner instead of persisting a second envelope.
  perform 1
  from public.boh_tenant tenant
  where tenant.id = requested_tenant_id
  for update;
  if not found then
    raise exception 'Vault tenant not found' using errcode = '23503';
  end if;

  return query
  select key_row.id, key_row.key_version, key_row.wrapping_key_ref, key_row.wrapped_key, key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id = requested_tenant_id and key_row.state = 'active'
  order by key_row.key_version desc
  limit 1;
  if found then return; end if;

  select coalesce(max(key_row.key_version), 0) + 1
  into next_key_version
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id = requested_tenant_id;

  created_key_id := gen_random_uuid();
  perform public.boh_vault_create_tenant_key(
    created_key_id,
    requested_tenant_id,
    next_key_version,
    requested_wrapping_key_ref,
    requested_wrapped_key,
    requested_actor_boh_user_id,
    requested_environment,
    requested_request_id,
    requested_service_identity
  );
  perform public.boh_vault_transition_tenant_key(
    created_key_id,
    requested_tenant_id,
    'active',
    requested_actor_boh_user_id,
    requested_environment,
    requested_request_id,
    requested_service_identity
  );

  return query
  select key_row.id, key_row.key_version, key_row.wrapping_key_ref, key_row.wrapped_key, key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id = requested_tenant_id and key_row.id = created_key_id;
end;
$$;

revoke all on function public.boh_vault_initialize_tenant_key(uuid,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_initialize_tenant_key(uuid,uuid,text,text,text,text,text)
  to service_role;

revoke all on function public.boh_vault_get_active_tenant_key(uuid,uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.boh_vault_read_secret_envelope(uuid,uuid,uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_get_active_tenant_key(uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.boh_vault_read_secret_envelope(uuid,uuid,uuid,uuid,text,text,text,text)
  to service_role;

comment on function public.boh_vault_get_active_tenant_key(uuid,uuid,text,text,text) is
  'Service-only encrypted tenant-key envelope lookup for authorized Vault writers.';
comment on function public.boh_vault_read_secret_envelope(uuid,uuid,uuid,uuid,text,text,text,text) is
  'Service-only exact protected-value envelope lookup with atomic reveal/copy audit. Returns no plaintext.';
