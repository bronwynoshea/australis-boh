-- Audited Vault item metadata editing with guarded protected-field reference changes.
begin;

create or replace function public.boh_vault_update_item_details(
  requested_item_id uuid,
  requested_tenant_id uuid,
  requested_environment text,
  requested_display_name text,
  requested_provider_key text,
  requested_protected_field_id uuid,
  requested_reference_name text,
  requested_actor_boh_user_id uuid,
  requested_request_id text,
  requested_service_identity text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_row public.boh_vault_items%rowtype;
  field_row public.boh_vault_item_fields%rowtype;
  reference_changed boolean := false;
begin
  perform public.boh_vault_require_service_actor(
    requested_tenant_id,
    requested_actor_boh_user_id,
    requested_environment
  );

  if btrim(coalesce(requested_display_name, '')) = '' then
    raise exception 'Vault item name is required' using errcode = '22023';
  end if;

  select * into item_row
  from public.boh_vault_items
  where tenant_id = requested_tenant_id
    and id = requested_item_id
    and environment = requested_environment
  for update;

  if not found then
    raise exception 'Vault item not found' using errcode = 'P0002';
  end if;

  if requested_protected_field_id is not null then
    select * into field_row
    from public.boh_vault_item_fields
    where tenant_id = requested_tenant_id
      and id = requested_protected_field_id
      and vault_item_id = requested_item_id
      and field_kind = 'protected'
    for update;

    if not found then
      raise exception 'Protected field not found' using errcode = 'P0002';
    end if;

    if btrim(coalesce(requested_reference_name, '')) = '' then
      raise exception 'Reference name is required' using errcode = '22023';
    end if;
    if requested_reference_name !~ '^[A-Z][A-Z0-9_]{0,159}$' then
      raise exception 'Reference name must use uppercase runtime-secret syntax' using errcode = '22023';
    end if;

    reference_changed := field_row.field_key <> requested_reference_name;
    if reference_changed and exists (
      select 1
      from public.boh_vault_sync_bindings binding
      where binding.tenant_id = requested_tenant_id
        and binding.vault_item_id = requested_item_id
        and binding.item_field_id = requested_protected_field_id
        and binding.state <> 'disabled'
    ) then
      raise exception 'Reference is used by an active connection' using errcode = '23505';
    end if;
  end if;

  update public.boh_vault_items
  set display_name = btrim(requested_display_name),
      provider_key = nullif(btrim(coalesce(requested_provider_key, '')), ''),
      updated_by = requested_actor_boh_user_id
  where tenant_id = requested_tenant_id
    and id = requested_item_id
    and environment = requested_environment;

  if reference_changed then
    update public.boh_vault_item_fields
    set field_key = requested_reference_name,
        updated_by = requested_actor_boh_user_id
    where tenant_id = requested_tenant_id
      and id = requested_protected_field_id
      and vault_item_id = requested_item_id;
  end if;

  perform public.boh_vault_append_audit_event(
    requested_tenant_id,
    requested_item_id,
    requested_actor_boh_user_id,
    requested_service_identity,
    'item_updated',
    requested_request_id,
    requested_environment,
    'item',
    requested_item_id,
    jsonb_build_object('item_type', item_row.item_type)
  );

  if reference_changed then
    perform public.boh_vault_append_audit_event(
      requested_tenant_id,
      requested_item_id,
      requested_actor_boh_user_id,
      requested_service_identity,
      'field_updated',
      requested_request_id,
      requested_environment,
      'item_field',
      requested_protected_field_id,
      jsonb_build_object('field_kind', 'protected')
    );
  end if;

  return requested_item_id;
end;
$$;

revoke all on function public.boh_vault_update_item_details(uuid,uuid,text,text,text,uuid,text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.boh_vault_update_item_details(uuid,uuid,text,text,text,uuid,text,uuid,text,text) to service_role;

comment on function public.boh_vault_update_item_details(uuid,uuid,text,text,text,uuid,text,uuid,text,text)
is 'Audited item metadata edit; protected reference changes are blocked while any non-disabled connection uses the field.';

commit;
