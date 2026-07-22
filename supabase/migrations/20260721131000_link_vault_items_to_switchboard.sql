-- Link Vault inventory to canonical Switchboard projects without moving protected values.
begin;

alter table public.boh_vault_items
  add column if not exists switchboard_project_id uuid;

alter table public.boh_vault_items
  drop constraint if exists boh_vault_items_switchboard_project_fkey,
  add constraint boh_vault_items_switchboard_project_fkey
    foreign key (tenant_id,switchboard_project_id)
    references public.boh_switchboard_projects(tenant_id,id)
    on delete restrict;

create index if not exists boh_vault_items_switchboard_project_idx
  on public.boh_vault_items(tenant_id,switchboard_project_id,environment)
  where value_state <> 'disabled';

grant select (switchboard_project_id) on public.boh_vault_items to authenticated;

create or replace function public.boh_vault_list_switchboard_project_options(
  requested_tenant_id uuid,
  requested_environment text
)
returns table(id uuid,project_key text,name text,environment text)
language plpgsql
stable
security definer
set search_path=public,private,pg_temp
as $$
begin
  if requested_environment not in ('development','production') then
    raise exception 'Unsupported Vault environment' using errcode='22023';
  end if;
  if not private.boh_vault_current_user_has_role(
    requested_tenant_id,
    array['vault_admin','vault_editor','vault_viewer']::text[],
    requested_environment
  ) then
    raise exception 'Exact-environment Vault access is required' using errcode='42501';
  end if;
  return query
  select project.id,project.project_key,project.name,project_environment.environment
  from public.boh_switchboard_projects project
  join public.boh_switchboard_project_environments project_environment
    on project_environment.tenant_id=project.tenant_id
   and project_environment.project_id=project.id
   and project_environment.environment=requested_environment
   and project_environment.status='active'
  where project.tenant_id=requested_tenant_id and project.status='active'
  order by project.name;
end;
$$;

create or replace function private.boh_vault_assert_switchboard_project(
  requested_tenant_id uuid,
  requested_project_id uuid,
  requested_environment text
)
returns void
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  if requested_project_id is null then return; end if;
  if not exists (
    select 1
    from public.boh_switchboard_projects project
    join public.boh_switchboard_project_environments environment
      on environment.tenant_id=project.tenant_id
     and environment.project_id=project.id
     and environment.environment=requested_environment
     and environment.status='active'
    where project.tenant_id=requested_tenant_id
      and project.id=requested_project_id
      and project.status='active'
  ) then
    raise exception 'Active Switchboard project environment not found' using errcode='P0002';
  end if;
end;
$$;

create or replace function public.boh_vault_upsert_item_v3(
  requested_item_id uuid,
  requested_tenant_id uuid,
  requested_item_key text,
  requested_display_name text,
  requested_item_type text,
  requested_provider_key text,
  requested_project_workspace text,
  requested_project_id text,
  requested_switchboard_project_id uuid,
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
set search_path=public,private,pg_temp
as $$
declare selected_item_id uuid;
begin
  perform private.boh_vault_assert_switchboard_project(
    requested_tenant_id,requested_switchboard_project_id,requested_environment
  );
  selected_item_id:=public.boh_vault_upsert_item_v2(
    requested_item_id,requested_tenant_id,requested_item_key,requested_display_name,
    requested_item_type,requested_provider_key,requested_project_workspace,
    requested_project_id,requested_service_url,requested_purpose,requested_environment,
    requested_description,requested_notes,requested_actor_boh_user_id,
    requested_request_id,requested_service_identity
  );
  update public.boh_vault_items set
    switchboard_project_id=requested_switchboard_project_id,
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=selected_item_id;
  return selected_item_id;
end;
$$;

create or replace function public.boh_vault_update_item_details_v4(
  requested_item_id uuid,
  requested_tenant_id uuid,
  requested_environment text,
  requested_display_name text,
  requested_provider_key text,
  requested_project_workspace text,
  requested_project_id text,
  requested_switchboard_project_id uuid,
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
set search_path=public,private,pg_temp
as $$
declare selected_item_id uuid;
begin
  perform private.boh_vault_assert_switchboard_project(
    requested_tenant_id,requested_switchboard_project_id,requested_environment
  );
  selected_item_id:=public.boh_vault_update_item_details_v3(
    requested_item_id,requested_tenant_id,requested_environment,requested_display_name,
    requested_provider_key,requested_project_workspace,requested_project_id,
    requested_service_url,requested_purpose,requested_description,
    requested_protected_field_id,requested_reference_name,requested_actor_boh_user_id,
    requested_request_id,requested_service_identity
  );
  update public.boh_vault_items set
    switchboard_project_id=requested_switchboard_project_id,
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=selected_item_id;
  return selected_item_id;
end;
$$;

revoke all on function private.boh_vault_assert_switchboard_project(uuid,uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function public.boh_vault_list_switchboard_project_options(uuid,text)
  from public,anon;
revoke all on function public.boh_vault_upsert_item_v3(
  uuid,uuid,text,text,text,text,text,text,uuid,text,text,text,text,text,uuid,text,text
) from public,anon,authenticated;
revoke all on function public.boh_vault_update_item_details_v4(
  uuid,uuid,text,text,text,text,text,uuid,text,text,text,uuid,text,uuid,text,text
) from public,anon,authenticated;
grant execute on function public.boh_vault_upsert_item_v3(
  uuid,uuid,text,text,text,text,text,text,uuid,text,text,text,text,text,uuid,text,text
) to service_role;
grant execute on function public.boh_vault_list_switchboard_project_options(uuid,text)
  to authenticated;
grant execute on function public.boh_vault_update_item_details_v4(
  uuid,uuid,text,text,text,text,text,uuid,text,text,text,uuid,text,uuid,text,text
) to service_role;

create or replace view public.boh_vault_items_safe
with (security_barrier=true,security_invoker=true) as
select item.id,item.tenant_id,item.item_key,item.display_name,item.item_type,
  item.provider_key,item.purpose,item.environment,item.description,item.notes,
  item.value_state,item.validation_state,
  item.last_validated_at,item.last_rotated_at,item.rotation_due_at,
  item.owner_boh_user_id,item.created_at,item.updated_at,
  item.project_workspace,item.project_id,item.service_url,item.switchboard_project_id
from public.boh_vault_items item
where item.value_state <> 'disabled'
  and private.boh_vault_can_access_item(item.tenant_id,item.id,item.environment,'read');

comment on column public.boh_vault_items.switchboard_project_id
  is 'Canonical Switchboard project reference. Protected values remain owned by BOH Vault.';
comment on column public.boh_vault_items.project_id
  is 'Optional legacy provider-specific inventory context; canonical provider resource IDs belong in Switchboard.';
comment on function public.boh_vault_list_switchboard_project_options(uuid,text)
  is 'Returns only active canonical project options after exact-environment Vault authorization.';
comment on function public.boh_vault_upsert_item_v3(
  uuid,uuid,text,text,text,text,text,text,uuid,text,text,text,text,text,uuid,text,text
) is 'Audited Vault item upsert with exact canonical Switchboard project and environment validation.';
comment on function public.boh_vault_update_item_details_v4(
  uuid,uuid,text,text,text,text,text,uuid,text,text,text,uuid,text,uuid,text,text
) is 'Audited Vault item edit with exact canonical Switchboard project and environment validation.';

commit;
