-- Add audited, non-destructive Vault item deletion.
-- Protected versions and audit history remain immutable; deleted items are disabled,
-- hidden from browser-safe item/field views, and disconnected from synchronization.
begin;

alter table public.boh_vault_audit_events
  drop constraint boh_vault_audit_events_event_type_check;
alter table public.boh_vault_audit_events
  add constraint boh_vault_audit_events_event_type_check check (event_type in (
    'secret_version_committed','secret_version_superseded','secret_version_revoked',
    'revealed','copied','rotated','sync_requested','sync_started','sync_completed','sync_failed','sync_cancelled',
    'sync_binding_created','sync_binding_updated','deployment_target_created','deployment_target_updated',
    'legacy_metadata_imported',
    'grant_created','grant_updated','grant_revoked',
    'item_created','item_updated','item_deleted','field_created','field_updated',
    'collection_created','collection_updated','collection_membership_added','collection_membership_removed',
    'tenant_key_created','tenant_key_activated','tenant_key_retired','tenant_key_revoked'
  ));

create or replace function public.boh_vault_archive_item(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_environment text,
  requested_actor_boh_user_id uuid,
  requested_service_identity text,
  requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item_row public.boh_vault_items%rowtype;
begin
  perform public.boh_vault_require_service_actor(
    requested_tenant_id,
    requested_actor_boh_user_id,
    requested_environment
  );

  if btrim(coalesce(requested_service_identity, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = '' then
    raise exception 'Service identity and request ID are required' using errcode = '22023';
  end if;

  select * into item_row
  from public.boh_vault_items
  where tenant_id = requested_tenant_id
    and id = requested_item_id
    and environment = requested_environment
    and value_state <> 'disabled'
  for update;
  if not found then
    raise exception 'Active Vault item not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.boh_vault_sync_runs
    where tenant_id = requested_tenant_id
      and vault_item_id = requested_item_id
      and status = 'running'
  ) then
    raise exception 'Vault item has an active synchronization run' using errcode = '23505';
  end if;

  update public.boh_vault_sync_runs
  set status = 'cancelled',
      completed_at = transaction_timestamp(),
      result_code = 'item_deleted'
  where tenant_id = requested_tenant_id
    and vault_item_id = requested_item_id
    and status = 'queued';

  update public.boh_vault_sync_bindings
  set state = 'disabled',
      updated_by = requested_actor_boh_user_id
  where tenant_id = requested_tenant_id
    and vault_item_id = requested_item_id
    and state <> 'disabled';

  update public.boh_vault_items
  set value_state = 'disabled',
      validation_state = 'unchecked',
      updated_by = requested_actor_boh_user_id
  where tenant_id = requested_tenant_id
    and id = requested_item_id
    and environment = requested_environment;

  perform public.boh_vault_append_audit_event(
    requested_tenant_id,
    requested_item_id,
    requested_actor_boh_user_id,
    requested_service_identity,
    'item_deleted',
    requested_request_id,
    requested_environment,
    'item',
    requested_item_id,
    jsonb_build_object('history_preserved', true)
  );
end;
$$;

revoke all on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text)
  to service_role;

create or replace view public.boh_vault_items_safe with (security_barrier = true) as
select item.id, item.tenant_id, item.item_key, item.display_name, item.item_type,
  item.provider_key, item.purpose, item.environment, item.description, item.notes,
  item.value_state, item.validation_state, item.last_validated_at, item.last_rotated_at,
  item.rotation_due_at, item.owner_boh_user_id, item.created_at, item.updated_at
from public.boh_vault_items item
where item.value_state <> 'disabled'
  and public.boh_vault_has_role(item.tenant_id,
    array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], item.environment);

create or replace view public.boh_vault_item_fields_safe with (security_barrier = true) as
select field.id, field.tenant_id, field.vault_item_id, field.field_key, field.label,
  field.field_kind,
  case when field.field_kind = 'plaintext' then field.plaintext_value else null end as plaintext_value,
  field.is_required, field.sort_order, field.created_at, field.updated_at
from public.boh_vault_item_fields field
join public.boh_vault_items item
  on item.tenant_id = field.tenant_id
 and item.id = field.vault_item_id
 and item.value_state <> 'disabled'
where public.boh_vault_has_role(field.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], item.environment);

comment on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text) is
  'Audits and disables a Vault item while preserving immutable protected-value and activity history.';

commit;
