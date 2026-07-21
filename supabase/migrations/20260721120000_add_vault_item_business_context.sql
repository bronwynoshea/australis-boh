-- Add platform-neutral project context to searchable Vault item metadata.
begin;

alter table public.boh_vault_items
  add column if not exists project_workspace text,
  add column if not exists project_id text,
  add column if not exists service_url text;

alter table public.boh_vault_items
  drop constraint if exists boh_vault_items_project_workspace_guard,
  add constraint boh_vault_items_project_workspace_guard check (
    project_workspace is null or (
      char_length(project_workspace) <= 240
      and public.boh_vault_plaintext_is_safe('project_workspace', 'Project or workspace', project_workspace)
    )
  ),
  drop constraint if exists boh_vault_items_project_id_guard,
  add constraint boh_vault_items_project_id_guard check (
    project_id is null or (
      char_length(project_id) <= 500
      and public.boh_vault_plaintext_is_safe('project_id', 'Project ID', project_id)
    )
  ),
  drop constraint if exists boh_vault_items_service_url_guard,
  add constraint boh_vault_items_service_url_guard check (
    service_url is null or (
      char_length(service_url) <= 2048
      and service_url ~ '^https://[^[:space:]]+$'
      and public.boh_vault_plaintext_is_safe('service_url', 'Service URL', service_url)
    )
  ),
  drop constraint if exists boh_vault_items_purpose_guard,
  add constraint boh_vault_items_purpose_guard check (
    purpose is null or (
      char_length(purpose) <= 1000
      and public.boh_vault_plaintext_is_safe('purpose', 'Purpose', purpose)
    )
  );

grant select (project_workspace,project_id,service_url)
  on public.boh_vault_items to authenticated;

create or replace function public.boh_vault_upsert_item_v2(
  requested_item_id uuid,
  requested_tenant_id uuid,
  requested_item_key text,
  requested_display_name text,
  requested_item_type text,
  requested_provider_key text,
  requested_project_workspace text,
  requested_project_id text,
  requested_service_url text,
  requested_purpose text,
  requested_environment text,
  requested_description text,
  requested_notes text,
  requested_actor_boh_user_id uuid,
  requested_request_id text,
  requested_service_identity text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare selected_item_id uuid;
begin
  if requested_service_url is not null
     and btrim(requested_service_url) <> ''
     and btrim(requested_service_url) !~ '^https://[^[:space:]]+$' then
    raise exception 'Service URL must use HTTPS' using errcode='22023';
  end if;

  selected_item_id := public.boh_vault_upsert_item(
    requested_item_id,
    requested_tenant_id,
    requested_item_key,
    requested_display_name,
    requested_item_type,
    requested_provider_key,
    requested_purpose,
    requested_environment,
    requested_description,
    requested_notes,
    requested_actor_boh_user_id,
    requested_request_id,
    requested_service_identity
  );

  update public.boh_vault_items set
    project_workspace=nullif(btrim(coalesce(requested_project_workspace,'')),''),
    project_id=nullif(btrim(coalesce(requested_project_id,'')),''),
    service_url=nullif(btrim(coalesce(requested_service_url,'')),''),
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=selected_item_id;

  return selected_item_id;
end;
$$;

create or replace function public.boh_vault_update_item_details_v3(
  requested_item_id uuid,
  requested_tenant_id uuid,
  requested_environment text,
  requested_display_name text,
  requested_provider_key text,
  requested_project_workspace text,
  requested_project_id text,
  requested_service_url text,
  requested_purpose text,
  requested_description text,
  requested_protected_field_id uuid,
  requested_reference_name text,
  requested_actor_boh_user_id uuid,
  requested_request_id text,
  requested_service_identity text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare selected_item_id uuid;
begin
  if requested_service_url is not null
     and btrim(requested_service_url) <> ''
     and btrim(requested_service_url) !~ '^https://[^[:space:]]+$' then
    raise exception 'Service URL must use HTTPS' using errcode='22023';
  end if;

  selected_item_id := public.boh_vault_update_item_details_v2(
    requested_item_id,
    requested_tenant_id,
    requested_environment,
    requested_display_name,
    requested_provider_key,
    requested_description,
    requested_protected_field_id,
    requested_reference_name,
    requested_actor_boh_user_id,
    requested_request_id,
    requested_service_identity
  );

  update public.boh_vault_items set
    project_workspace=nullif(btrim(coalesce(requested_project_workspace,'')),''),
    project_id=nullif(btrim(coalesce(requested_project_id,'')),''),
    service_url=nullif(btrim(coalesce(requested_service_url,'')),''),
    purpose=nullif(btrim(coalesce(requested_purpose,'')),''),
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=selected_item_id;

  return selected_item_id;
end;
$$;

revoke all on function public.boh_vault_upsert_item_v2(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text
) from public,anon,authenticated;
revoke all on function public.boh_vault_update_item_details_v3(
  uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,uuid,text,text
) from public,anon,authenticated;
grant execute on function public.boh_vault_upsert_item_v2(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text
) to service_role;
grant execute on function public.boh_vault_update_item_details_v3(
  uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,uuid,text,text
) to service_role;

create or replace view public.boh_vault_items_safe
with (security_barrier=true, security_invoker=true) as
select item.id,item.tenant_id,item.item_key,item.display_name,item.item_type,
  item.provider_key,item.purpose,item.environment,item.description,item.notes,
  item.value_state,item.validation_state,
  item.last_validated_at,item.last_rotated_at,item.rotation_due_at,
  item.owner_boh_user_id,item.created_at,item.updated_at,
  item.project_workspace,item.project_id,item.service_url
from public.boh_vault_items item
where item.value_state <> 'disabled'
  and private.boh_vault_can_access_item(item.tenant_id,item.id,item.environment,'read');

comment on column public.boh_vault_items.project_workspace
  is 'Searchable platform-neutral project or workspace name; never protected material.';
comment on column public.boh_vault_items.project_id
  is 'Searchable external project or workspace identifier; never protected material.';
comment on column public.boh_vault_items.service_url
  is 'Searchable HTTPS service endpoint; never protected material.';
comment on function public.boh_vault_upsert_item_v2(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,uuid,text,text
) is 'Audited item upsert with platform-neutral project context.';
comment on function public.boh_vault_update_item_details_v3(
  uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,uuid,text,text
) is 'Audited item edit with platform-neutral project context and protected reference safety.';

commit;
