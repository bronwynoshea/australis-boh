begin;

do $$
begin
  if exists (
    select 1 from public.boh_vault_items
    where item_type='login' and created_by is null
  ) then
    raise exception 'Password items require an immutable creator before access enforcement';
  end if;
  if exists (
    select 1
    from public.boh_vault_sync_runs run
    join public.boh_vault_items item
      on item.tenant_id=run.tenant_id and item.id=run.vault_item_id
    where item.item_type='login' and run.status='running'
  ) then
    raise exception 'Running password synchronization must be resolved before access enforcement';
  end if;
end;
$$;

-- Legacy null-environment grants predate the central Development/Production
-- inventory. Preserve them as Development-only access and never infer Production.
update public.boh_vault_access_grants legacy_grant
set status='revoked',
    revoked_by=coalesce(legacy_grant.granted_by,legacy_grant.boh_user_id),
    updated_at=transaction_timestamp()
where legacy_grant.environment is null
  and legacy_grant.status='active'
  and exists (
    select 1 from public.boh_vault_access_grants exact_grant
    where exact_grant.tenant_id=legacy_grant.tenant_id
      and exact_grant.boh_user_id=legacy_grant.boh_user_id
      and exact_grant.role=legacy_grant.role
      and exact_grant.environment='development'
      and exact_grant.status='active'
  );

update public.boh_vault_access_grants
set environment='development',updated_at=transaction_timestamp()
where environment is null;

alter table public.boh_vault_access_grants
  alter column environment set not null;

create or replace function public.boh_vault_user_has_exact_environment_role(
  requested_tenant_id uuid,
  requested_boh_user_id uuid,
  allowed_roles text[],
  requested_environment text
)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select requested_environment in ('development','production') and exists (
    select 1
    from public.boh_tenant tenant
    join public.boh_tenant_member member on member.tenant_id=tenant.id
    join public.boh_user user_row
      on user_row.id=member.user_id and user_row.tenant_id=member.tenant_id
    join public.boh_vault_access_grants grant_row
      on grant_row.tenant_id=member.tenant_id and grant_row.boh_user_id=member.user_id
    join public.boh_app app
      on app.slug='vault' and app.app_context='boh' and app.is_active
    join public.boh_tenant_app tenant_app
      on tenant_app.tenant_id=tenant.id and tenant_app.app_id=app.id
    where tenant.id=requested_tenant_id
      and tenant.status='active'
      and user_row.id=requested_boh_user_id
      and user_row.status='active'
      and user_row.app_context='boh'
      and member.membership_status='active'
      and tenant_app.status='enabled'
      and grant_row.status='active'
      and (grant_row.expires_at is null or grant_row.expires_at>now())
      and grant_row.role=any(allowed_roles)
      and grant_row.environment=requested_environment
  )
$$;

revoke all on function public.boh_vault_user_has_exact_environment_role(uuid,uuid,text[],text)
  from public,anon,authenticated,service_role;

-- Every Vault item has one immutable BOH application owner. Existing operational
-- credentials remain administrator-managed; the owner records who created them.
update public.boh_vault_items
set owner_boh_user_id = coalesce(owner_boh_user_id, created_by, updated_by)
where owner_boh_user_id is null
  and coalesce(created_by, updated_by) is not null;

-- created_by is the canonical password owner. Normalize any legacy display owner
-- before both fields become immutable.
update public.boh_vault_items
set owner_boh_user_id = created_by
where item_type = 'login'
  and owner_boh_user_id is distinct from created_by;

alter table public.boh_vault_items
  drop constraint if exists boh_vault_login_creator_required;
alter table public.boh_vault_items
  add constraint boh_vault_login_creator_required
  check (item_type <> 'login' or created_by is not null);
create index if not exists boh_vault_items_kind_creator_idx
  on public.boh_vault_items(tenant_id,environment,item_type,created_by);

create or replace function public.boh_vault_user_can_access_item(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_access text default 'read'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when requested_access not in ('read', 'write', 'sync') then false
      when requested_access in ('write','sync') and item.value_state = 'disabled' then false
      when item.item_type = 'login' then
        requested_access <> 'sync'
        and item.created_by = requested_actor_boh_user_id
        and public.boh_vault_user_has_exact_environment_role(
          requested_tenant_id,
          requested_actor_boh_user_id,
          array['vault_admin','vault_editor','vault_viewer']::text[],
          requested_environment
        )
      else
        public.boh_vault_user_has_exact_environment_role(
          requested_tenant_id,
          requested_actor_boh_user_id,
          array['vault_admin']::text[],
          requested_environment
        )
    end
    from public.boh_vault_items item
    where item.tenant_id = requested_tenant_id
      and item.id = requested_item_id
      and item.environment = requested_environment
  ), false)
$$;

revoke all on function public.boh_vault_user_can_access_item(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_user_can_access_item(uuid,uuid,uuid,text,text)
  to service_role;

create schema if not exists private;

create or replace function private.boh_vault_current_actor_id(requested_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select user_row.id
  from public.boh_user user_row
  where user_row.auth_user_id = (select auth.uid())
    and user_row.tenant_id = requested_tenant_id
    and user_row.app_context = 'boh'
    and user_row.status = 'active'
  order by user_row.created_at asc nulls last
  limit 1
$$;

create or replace function private.boh_vault_can_access_item(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_environment text,
  requested_access text default 'read'
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select public.boh_vault_user_can_access_item(
    requested_tenant_id,
    requested_item_id,
    private.boh_vault_current_actor_id(requested_tenant_id),
    requested_environment,
    requested_access
  )
$$;

create or replace function private.boh_vault_current_user_has_role(
  requested_tenant_id uuid,
  allowed_roles text[],
  requested_environment text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select public.boh_vault_user_has_exact_environment_role(
    requested_tenant_id,
    private.boh_vault_current_actor_id(requested_tenant_id),
    allowed_roles,
    requested_environment
  )
$$;

revoke all on function private.boh_vault_current_actor_id(uuid) from public, anon;
revoke all on function private.boh_vault_can_access_item(uuid,uuid,text,text) from public, anon;
revoke all on function private.boh_vault_current_user_has_role(uuid,text[],text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.boh_vault_current_actor_id(uuid) to authenticated;
grant execute on function private.boh_vault_can_access_item(uuid,uuid,text,text) to authenticated;
grant execute on function private.boh_vault_current_user_has_role(uuid,text[],text) to authenticated;

create or replace function public.boh_vault_assert_sync_actor(
  requested_tenant_id uuid, requested_actor_boh_user_id uuid,
  requested_environment text, allowed_roles text[], requested_service_identity text
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if requested_environment not in ('development','production')
     or btrim(coalesce(requested_service_identity,''))='' then
    raise exception 'Valid environment and service identity are required' using errcode='22023';
  end if;
  if not public.boh_vault_user_has_exact_environment_role(
    requested_tenant_id,requested_actor_boh_user_id,
    array['vault_admin']::text[],requested_environment
  ) then
    raise exception 'Actor is not an authorized Vault administrator for this tenant/environment'
      using errcode='42501';
  end if;
end;
$$;

revoke all on function public.boh_vault_assert_sync_actor(uuid,uuid,text,text[],text)
  from public,anon,authenticated,service_role;

create or replace function public.boh_vault_get_active_tenant_key_for_item(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_service_identity text,
  requested_request_id text
)
returns table (
  tenant_key_id uuid, key_version integer, wrapping_key_ref text,
  wrapped_key text, algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if btrim(coalesce(requested_service_identity,'')) = ''
     or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Service identity and request ID are required' using errcode = '22023';
  end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_environment,'write'
  ) then
    raise exception 'Actor cannot access this Vault item' using errcode = '42501';
  end if;

  return query
  select key_row.id,key_row.key_version,key_row.wrapping_key_ref,
    key_row.wrapped_key,key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id=requested_tenant_id and key_row.state='active'
  order by key_row.key_version desc
  limit 1;
  if not found then
    raise exception 'No active Vault tenant key exists' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.boh_vault_initialize_tenant_key_for_item(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_actor_boh_user_id uuid,
  requested_environment text,
  requested_wrapping_key_ref text,
  requested_wrapped_key text,
  requested_service_identity text,
  requested_request_id text
)
returns table (
  tenant_key_id uuid, key_version integer, wrapping_key_ref text,
  wrapped_key text, algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare created_key_id uuid; next_key_version integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_environment,'write'
  ) then
    raise exception 'Actor cannot access this Vault item' using errcode = '42501';
  end if;
  if btrim(coalesce(requested_wrapping_key_ref,'')) = ''
     or btrim(coalesce(requested_wrapped_key,'')) = ''
     or btrim(coalesce(requested_service_identity,'')) = ''
     or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Wrapped key, service identity, and request ID are required' using errcode = '22023';
  end if;

  perform 1 from public.boh_tenant where id=requested_tenant_id for update;
  if not found then raise exception 'Vault tenant not found' using errcode='23503'; end if;

  return query
  select key_row.id,key_row.key_version,key_row.wrapping_key_ref,
    key_row.wrapped_key,key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id=requested_tenant_id and key_row.state='active'
  order by key_row.key_version desc limit 1;
  if found then return; end if;

  select coalesce(max(key_row.key_version),0)+1 into next_key_version
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id=requested_tenant_id;
  created_key_id := gen_random_uuid();
  insert into public.boh_vault_tenant_keys(
    id,tenant_id,key_version,wrapping_key_ref,wrapped_key,algorithm,state,
    activated_at,created_by
  ) values (
    created_key_id,requested_tenant_id,next_key_version,
    requested_wrapping_key_ref,requested_wrapped_key,'AES-256-GCM','active',
    transaction_timestamp(),requested_actor_boh_user_id
  );
  insert into public.boh_vault_audit_events(
    tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,
    request_id,environment,subject_type,subject_id,metadata
  ) values (
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'tenant_key_created',requested_request_id,
    requested_environment,'tenant_key',created_key_id,
    jsonb_build_object('key_version',next_key_version,'algorithm','AES-256-GCM','activated',true)
  );
  insert into public.boh_vault_audit_events(
    tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,
    request_id,environment,subject_type,subject_id,metadata
  ) values (
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'tenant_key_activated',requested_request_id,
    requested_environment,'tenant_key',created_key_id,
    jsonb_build_object('key_version',next_key_version,'algorithm','AES-256-GCM')
  );

  return query
  select key_row.id,key_row.key_version,key_row.wrapping_key_ref,
    key_row.wrapped_key,key_row.algorithm
  from public.boh_vault_tenant_keys key_row
  where key_row.tenant_id=requested_tenant_id and key_row.id=created_key_id;
end;
$$;

revoke all on function public.boh_vault_get_active_tenant_key(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.boh_vault_initialize_tenant_key(uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.boh_vault_get_active_tenant_key_for_item(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.boh_vault_initialize_tenant_key_for_item(uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.boh_vault_get_active_tenant_key_for_item(uuid,uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.boh_vault_initialize_tenant_key_for_item(uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create or replace function public.boh_vault_upsert_item(
  requested_item_id uuid, requested_tenant_id uuid, requested_item_key text,
  requested_display_name text, requested_item_type text, requested_provider_key text,
  requested_purpose text, requested_environment text, requested_description text,
  requested_notes text, requested_actor_boh_user_id uuid, requested_request_id text,
  requested_service_identity text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item_row public.boh_vault_items%rowtype; existed boolean := false;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if requested_environment not in ('development','production')
     or requested_item_type not in ('login','credential','recovery_record','ssh_key','certificate','other')
     or btrim(coalesce(requested_item_key,''))=''
     or btrim(coalesce(requested_display_name,''))=''
     or btrim(coalesce(requested_request_id,''))=''
     or btrim(coalesce(requested_service_identity,''))='' then
    raise exception 'Valid Vault item input is required' using errcode='22023';
  end if;

  select * into item_row from public.boh_vault_items
  where tenant_id=requested_tenant_id and id=requested_item_id for update;
  existed := found;
  if existed then
    if item_row.environment <> requested_environment or item_row.item_type <> requested_item_type then
      raise exception 'Vault item kind and environment are immutable' using errcode='42501';
    end if;
    if not public.boh_vault_user_can_access_item(
      requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
      requested_environment,'write'
    ) then
      raise exception 'Actor cannot modify this Vault item' using errcode='42501';
    end if;
    update public.boh_vault_items set
      item_key=requested_item_key,display_name=requested_display_name,
      provider_key=requested_provider_key,purpose=requested_purpose,
      description=requested_description,notes=requested_notes,
      updated_by=requested_actor_boh_user_id
    where tenant_id=requested_tenant_id and id=requested_item_id;
  else
    if requested_item_type='login' then
      if not public.boh_vault_user_has_exact_environment_role(
        requested_tenant_id,requested_actor_boh_user_id,
        array['vault_admin','vault_editor','vault_viewer']::text[],requested_environment
      ) then
        raise exception 'Actor cannot create this Vault item' using errcode='42501';
      end if;
    elsif not public.boh_vault_user_has_exact_environment_role(
      requested_tenant_id,requested_actor_boh_user_id,
      array['vault_admin']::text[],requested_environment
    ) then
      raise exception 'Actor cannot create this Vault item' using errcode='42501';
    end if;
    insert into public.boh_vault_items(
      id,tenant_id,item_key,display_name,item_type,provider_key,purpose,
      environment,description,notes,owner_boh_user_id,created_by,updated_by
    ) values (
      requested_item_id,requested_tenant_id,requested_item_key,requested_display_name,
      requested_item_type,requested_provider_key,requested_purpose,requested_environment,
      requested_description,requested_notes,requested_actor_boh_user_id,
      requested_actor_boh_user_id,requested_actor_boh_user_id
    );
  end if;
  perform public.boh_vault_append_audit_event(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,case when existed then 'item_updated' else 'item_created' end,
    requested_request_id,requested_environment,'item',requested_item_id,
    jsonb_build_object('item_key',requested_item_key,'item_type',requested_item_type)
  );
  return requested_item_id;
end;
$$;

create or replace function public.boh_vault_upsert_item_field(
  requested_field_id uuid, requested_tenant_id uuid, requested_item_id uuid,
  requested_environment text, requested_field_key text, requested_label text,
  requested_field_kind text, requested_plaintext_value text,
  requested_is_required boolean, requested_sort_order integer, requested_metadata jsonb,
  requested_actor_boh_user_id uuid, requested_request_id text,
  requested_service_identity text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare field_row public.boh_vault_item_fields%rowtype; existed boolean := false;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_environment,'write'
  ) then
    raise exception 'Actor cannot modify fields for this Vault item' using errcode='42501';
  end if;
  if requested_field_kind not in ('plaintext','protected')
     or (requested_field_kind='protected' and requested_plaintext_value is not null)
     or btrim(coalesce(requested_field_key,''))=''
     or btrim(coalesce(requested_label,''))='' then
    raise exception 'Valid Vault field input is required' using errcode='22023';
  end if;
  select * into field_row from public.boh_vault_item_fields
  where tenant_id=requested_tenant_id and id=requested_field_id for update;
  existed := found;
  if existed then
    if field_row.vault_item_id <> requested_item_id or field_row.field_kind <> requested_field_kind then
      raise exception 'Vault field item and kind are immutable' using errcode='42501';
    end if;
    update public.boh_vault_item_fields set
      field_key=requested_field_key,label=requested_label,
      plaintext_value=requested_plaintext_value,is_required=requested_is_required,
      sort_order=requested_sort_order,metadata=coalesce(requested_metadata,'{}'::jsonb),
      updated_by=requested_actor_boh_user_id
    where tenant_id=requested_tenant_id and id=requested_field_id;
  else
    insert into public.boh_vault_item_fields(
      id,tenant_id,vault_item_id,field_key,label,field_kind,plaintext_value,
      is_required,sort_order,metadata,created_by,updated_by
    ) values (
      requested_field_id,requested_tenant_id,requested_item_id,requested_field_key,
      requested_label,requested_field_kind,requested_plaintext_value,
      requested_is_required,requested_sort_order,coalesce(requested_metadata,'{}'::jsonb),
      requested_actor_boh_user_id,requested_actor_boh_user_id
    );
  end if;
  perform public.boh_vault_recompute_item_readiness(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id
  );
  perform public.boh_vault_append_audit_event(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,case when existed then 'field_updated' else 'field_created' end,
    requested_request_id,requested_environment,'item_field',requested_field_id,
    jsonb_build_object('field_key',requested_field_key,'field_kind',requested_field_kind,'is_required',requested_is_required)
  );
  return requested_field_id;
end;
$$;

revoke all on function public.boh_vault_upsert_item(uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.boh_vault_upsert_item_field(uuid,uuid,uuid,text,text,text,text,text,boolean,integer,jsonb,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.boh_vault_upsert_item(uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,text)
  to service_role;
grant execute on function public.boh_vault_upsert_item_field(uuid,uuid,uuid,text,text,text,text,text,boolean,integer,jsonb,uuid,text,text)
  to service_role;

create or replace function public.boh_vault_update_item_details_v2(
  requested_item_id uuid, requested_tenant_id uuid, requested_environment text,
  requested_display_name text, requested_provider_key text, requested_description text,
  requested_protected_field_id uuid, requested_reference_name text,
  requested_actor_boh_user_id uuid, requested_request_id text,
  requested_service_identity text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item_row public.boh_vault_items%rowtype;
  field_row public.boh_vault_item_fields%rowtype; reference_changed boolean := false;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if btrim(coalesce(requested_display_name,''))='' then
    raise exception 'Vault item name is required' using errcode='22023';
  end if;
  select * into item_row from public.boh_vault_items
  where tenant_id=requested_tenant_id and id=requested_item_id
    and environment=requested_environment for update;
  if not found then raise exception 'Vault item not found' using errcode='P0002'; end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_environment,'write'
  ) then
    raise exception 'Actor cannot modify this Vault item' using errcode='42501';
  end if;
  if item_row.item_type='login' and requested_protected_field_id is not null then
    raise exception 'Password references cannot be synchronized' using errcode='42501';
  end if;
  if requested_protected_field_id is not null then
    select * into field_row from public.boh_vault_item_fields
    where tenant_id=requested_tenant_id and id=requested_protected_field_id
      and vault_item_id=requested_item_id and field_kind='protected' for update;
    if not found then raise exception 'Protected field not found' using errcode='P0002'; end if;
    if btrim(coalesce(requested_reference_name,''))=''
       or requested_reference_name !~ '^[A-Z][A-Z0-9_]{0,159}$' then
      raise exception 'Valid uppercase reference name is required' using errcode='22023';
    end if;
    reference_changed := field_row.field_key <> requested_reference_name;
    if reference_changed and exists (
      select 1 from public.boh_vault_sync_bindings binding
      where binding.tenant_id=requested_tenant_id
        and binding.vault_item_id=requested_item_id
        and binding.item_field_id=requested_protected_field_id
        and binding.state<>'disabled'
    ) then raise exception 'Reference is used by an active connection' using errcode='23505'; end if;
  end if;
  update public.boh_vault_items set
    display_name=btrim(requested_display_name),
    provider_key=nullif(btrim(coalesce(requested_provider_key,'')),''),
    description=nullif(btrim(coalesce(requested_description,'')),''),
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=requested_item_id;
  if reference_changed then
    update public.boh_vault_item_fields set field_key=requested_reference_name,
      updated_by=requested_actor_boh_user_id
    where tenant_id=requested_tenant_id and id=requested_protected_field_id
      and vault_item_id=requested_item_id;
  end if;
  perform public.boh_vault_append_audit_event(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'item_updated',requested_request_id,
    requested_environment,'item',requested_item_id,
    jsonb_build_object('item_type',item_row.item_type)
  );
  if reference_changed then
    perform public.boh_vault_append_audit_event(
      requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
      requested_service_identity,'field_updated',requested_request_id,
      requested_environment,'item_field',requested_protected_field_id,
      jsonb_build_object('field_kind','protected')
    );
  end if;
  return requested_item_id;
end;
$$;

create or replace function public.boh_vault_update_item_details(
  requested_item_id uuid, requested_tenant_id uuid, requested_environment text,
  requested_display_name text, requested_provider_key text,
  requested_protected_field_id uuid, requested_reference_name text,
  requested_actor_boh_user_id uuid, requested_request_id text,
  requested_service_identity text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare current_description text;
begin
  select description into current_description from public.boh_vault_items
  where tenant_id=requested_tenant_id and id=requested_item_id
    and environment=requested_environment;
  return public.boh_vault_update_item_details_v2(
    requested_item_id,requested_tenant_id,requested_environment,
    requested_display_name,requested_provider_key,current_description,
    requested_protected_field_id,requested_reference_name,
    requested_actor_boh_user_id,requested_request_id,requested_service_identity
  );
end;
$$;

create or replace function public.boh_vault_archive_item(
  requested_tenant_id uuid, requested_item_id uuid, requested_environment text,
  requested_actor_boh_user_id uuid, requested_service_identity text,
  requested_request_id text
)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item_row public.boh_vault_items%rowtype;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if btrim(coalesce(requested_service_identity,''))=''
     or btrim(coalesce(requested_request_id,''))='' then
    raise exception 'Service identity and request ID are required' using errcode='22023';
  end if;
  select * into item_row from public.boh_vault_items
  where tenant_id=requested_tenant_id and id=requested_item_id
    and environment=requested_environment and value_state<>'disabled' for update;
  if not found then raise exception 'Active Vault item not found' using errcode='P0002'; end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_environment,'write'
  ) then raise exception 'Actor cannot modify this Vault item' using errcode='42501'; end if;
  if exists (
    select 1 from public.boh_vault_sync_runs
    where tenant_id=requested_tenant_id and vault_item_id=requested_item_id
      and status='running'
  ) then raise exception 'Vault item has an active synchronization run' using errcode='23505'; end if;
  update public.boh_vault_sync_runs set status='cancelled',
    completed_at=transaction_timestamp(),result_code='item_deleted'
  where tenant_id=requested_tenant_id and vault_item_id=requested_item_id and status='queued';
  update public.boh_vault_sync_bindings set state='disabled',updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and vault_item_id=requested_item_id and state<>'disabled';
  update public.boh_vault_items set value_state='disabled',validation_state='unchecked',
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=requested_item_id;
  perform public.boh_vault_append_audit_event(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'item_deleted',requested_request_id,
    requested_environment,'item',requested_item_id,
    jsonb_build_object('history_preserved',true)
  );
end;
$$;

revoke all on function public.boh_vault_update_item_details_v2(uuid,uuid,text,text,text,text,uuid,text,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.boh_vault_update_item_details(uuid,uuid,text,text,text,uuid,text,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.boh_vault_update_item_details_v2(uuid,uuid,text,text,text,text,uuid,text,uuid,text,text)
  to service_role;
grant execute on function public.boh_vault_update_item_details(uuid,uuid,text,text,text,uuid,text,uuid,text,text)
  to service_role;
grant execute on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text)
  to service_role;

create or replace function public.boh_vault_commit_secret_version(
  requested_tenant_id uuid, requested_item_id uuid, requested_field_id uuid,
  requested_tenant_key_id uuid, requested_actor_boh_user_id uuid,
  requested_ciphertext text, requested_nonce text, requested_wrapped_data_key text,
  requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare item_environment text; next_version integer; committed_id uuid;
  prior_version_id uuid; prior_version integer; item_is_ready boolean;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode='42501';
  end if;
  if btrim(coalesce(requested_ciphertext,''))=''
     or btrim(coalesce(requested_nonce,''))=''
     or btrim(coalesce(requested_wrapped_data_key,''))=''
     or btrim(coalesce(requested_request_id,''))=''
     or btrim(coalesce(requested_service_identity,''))='' then
    raise exception 'Encrypted payload, request ID, and service identity are required' using errcode='22023';
  end if;
  select item.environment into item_environment
  from public.boh_vault_items item
  join public.boh_vault_item_fields field
    on field.tenant_id=item.tenant_id and field.vault_item_id=item.id
   and field.id=requested_field_id
  join public.boh_vault_tenant_keys tenant_key
    on tenant_key.tenant_id=item.tenant_id and tenant_key.id=requested_tenant_key_id
   and tenant_key.state='active'
  where item.tenant_id=requested_tenant_id and item.id=requested_item_id
    and item.value_state<>'disabled' and field.field_kind='protected'
  for update of item,field;
  if item_environment is null then
    raise exception 'Exact active item/protected-field/tenant-key relationship not found' using errcode='23503';
  end if;
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    item_environment,'write'
  ) then raise exception 'Actor cannot modify this Vault item' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_tenant_id::text||requested_field_id::text,0));
  select coalesce(max(version),0)+1 into next_version
  from public.boh_vault_secret_versions
  where tenant_id=requested_tenant_id and item_field_id=requested_field_id;
  update public.boh_vault_secret_versions
  set state='superseded',superseded_at=transaction_timestamp()
  where tenant_id=requested_tenant_id and item_field_id=requested_field_id and state='active'
  returning id,version into prior_version_id,prior_version;
  insert into public.boh_vault_secret_versions(
    tenant_id,vault_item_id,item_field_id,tenant_key_id,version,ciphertext,nonce,
    wrapped_data_key,algorithm,state,created_by,activated_at
  ) values (
    requested_tenant_id,requested_item_id,requested_field_id,requested_tenant_key_id,
    next_version,requested_ciphertext,requested_nonce,requested_wrapped_data_key,
    'AES-256-GCM','active',requested_actor_boh_user_id,transaction_timestamp()
  ) returning id into committed_id;
  select not exists (
    select 1 from public.boh_vault_item_fields required_field
    where required_field.tenant_id=requested_tenant_id
      and required_field.vault_item_id=requested_item_id and required_field.is_required
      and (
        (required_field.field_kind='plaintext' and btrim(coalesce(required_field.plaintext_value,''))='')
        or (required_field.field_kind='protected' and not exists (
          select 1 from public.boh_vault_secret_versions active_version
          where active_version.tenant_id=required_field.tenant_id
            and active_version.vault_item_id=required_field.vault_item_id
            and active_version.item_field_id=required_field.id and active_version.state='active'
        ))
      )
  ) into item_is_ready;
  update public.boh_vault_items set
    value_state=case when item_is_ready then 'configured' else 'needs_setup' end,
    last_rotated_at=case when prior_version_id is not null then transaction_timestamp() else last_rotated_at end,
    updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=requested_item_id;
  insert into public.boh_vault_audit_events(
    tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,
    request_id,environment,subject_type,subject_id,metadata
  ) values (
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'secret_version_committed',requested_request_id,
    item_environment,'secret_version',committed_id,
    jsonb_build_object('version',next_version,'prior_version',prior_version,
      'prior_version_id',prior_version_id,'algorithm','AES-256-GCM','field_id',requested_field_id)
  );
  if prior_version_id is not null then
    insert into public.boh_vault_audit_events(
      tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,
      request_id,environment,subject_type,subject_id,metadata
    ) values
      (requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
       requested_service_identity,'secret_version_superseded',requested_request_id,
       item_environment,'secret_version',prior_version_id,
       jsonb_build_object('prior_version',prior_version,'new_version',next_version,
         'new_version_id',committed_id,'field_id',requested_field_id)),
      (requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
       requested_service_identity,'rotated',requested_request_id,item_environment,
       'item_field',requested_field_id,
       jsonb_build_object('prior_version',prior_version,'prior_version_id',prior_version_id,
         'new_version',next_version,'new_version_id',committed_id));
  end if;
  return committed_id;
end;
$$;

revoke all on function public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create or replace function public.boh_vault_guard_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare actor_id uuid;
begin
  actor_id := coalesce(new.updated_by, new.created_by);
  if tg_op = 'INSERT' then
    new.owner_boh_user_id := coalesce(new.owner_boh_user_id, new.created_by);
    if new.owner_boh_user_id is null or new.owner_boh_user_id is distinct from new.created_by then
      raise exception 'Vault item owner must be its creator' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.owner_boh_user_id is distinct from old.owner_boh_user_id
     or new.item_type is distinct from old.item_type
     or new.tenant_id is distinct from old.tenant_id
     or new.environment is distinct from old.environment
     or new.created_by is distinct from old.created_by then
    raise exception 'Vault item creator, owner, kind, tenant, and environment are immutable' using errcode = '42501';
  end if;
  if not public.boh_vault_user_can_access_item(
    old.tenant_id, old.id, actor_id, old.environment, 'write'
  ) then
    raise exception 'Actor cannot modify this Vault item' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists boh_vault_items_ownership_guard on public.boh_vault_items;
create trigger boh_vault_items_ownership_guard
before insert or update on public.boh_vault_items
for each row execute function public.boh_vault_guard_item_ownership();

create or replace function public.boh_vault_guard_item_field_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare item_row public.boh_vault_items%rowtype; actor_id uuid;
begin
  select * into item_row
  from public.boh_vault_items
  where tenant_id = coalesce(new.tenant_id, old.tenant_id)
    and id = coalesce(new.vault_item_id, old.vault_item_id);
  actor_id := coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by);
  if not found or not public.boh_vault_user_can_access_item(
    item_row.tenant_id, item_row.id, actor_id, item_row.environment, 'write'
  ) then
    raise exception 'Actor cannot modify fields for this Vault item' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists boh_vault_item_fields_access_guard on public.boh_vault_item_fields;
create trigger boh_vault_item_fields_access_guard
before insert or update on public.boh_vault_item_fields
for each row execute function public.boh_vault_guard_item_field_access();

create or replace function public.boh_vault_guard_secret_item_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare item_row public.boh_vault_items%rowtype;
begin
  select * into item_row
  from public.boh_vault_items
  where tenant_id = new.tenant_id and id = new.vault_item_id;
  if not found or not public.boh_vault_user_can_access_item(
    item_row.tenant_id, item_row.id, new.created_by, item_row.environment, 'write'
  ) then
    raise exception 'Actor cannot set this protected Vault value' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists boh_vault_secret_versions_item_access_guard on public.boh_vault_secret_versions;
create trigger boh_vault_secret_versions_item_access_guard
before insert on public.boh_vault_secret_versions
for each row execute function public.boh_vault_guard_secret_item_access();

-- Passwords are personal records and can never become deployment inputs.
update public.boh_vault_sync_runs run
set status = 'cancelled', completed_at = transaction_timestamp(), result_code = 'password_not_syncable'
from public.boh_vault_items item
where item.tenant_id = run.tenant_id
  and item.id = run.vault_item_id
  and item.item_type = 'login'
  and run.status = 'queued';

update public.boh_vault_sync_bindings binding
set state = 'disabled'
from public.boh_vault_items item
where item.tenant_id = binding.tenant_id
  and item.id = binding.vault_item_id
  and item.item_type = 'login'
  and binding.state <> 'disabled';

-- Passwords were never intended to participate in shared collections. Preserve
-- an item-private migration audit event, then remove any historical membership.
insert into public.boh_vault_audit_events (
  tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,
  request_id,environment,subject_type,subject_id,metadata
)
select
  membership.tenant_id,membership.vault_item_id,null,
  'migration:20260719223000','collection_membership_removed',
  'migration:password-collection:' || membership.id::text,
  membership.environment,'collection_item',membership.id,
  jsonb_build_object('reason','passwords_cannot_be_shared')
from public.boh_vault_collection_items membership
join public.boh_vault_items item
  on item.tenant_id=membership.tenant_id and item.id=membership.vault_item_id
where item.item_type='login'
on conflict do nothing;

delete from public.boh_vault_collection_items membership
using public.boh_vault_items item
where item.tenant_id=membership.tenant_id
  and item.id=membership.vault_item_id
  and item.item_type='login';

create or replace function public.boh_vault_guard_syncable_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.boh_vault_items item
    where item.tenant_id = new.tenant_id
      and item.id = new.vault_item_id
      and item.item_type = 'login'
  ) then
    raise exception 'Personal passwords cannot be synchronized' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists boh_vault_sync_bindings_item_kind_guard on public.boh_vault_sync_bindings;
create trigger boh_vault_sync_bindings_item_kind_guard
before insert or update on public.boh_vault_sync_bindings
for each row execute function public.boh_vault_guard_syncable_item();

drop trigger if exists boh_vault_sync_runs_item_kind_guard on public.boh_vault_sync_runs;
create trigger boh_vault_sync_runs_item_kind_guard
before insert or update on public.boh_vault_sync_runs
for each row execute function public.boh_vault_guard_syncable_item();

drop trigger if exists boh_vault_collection_items_item_kind_guard on public.boh_vault_collection_items;
create trigger boh_vault_collection_items_item_kind_guard
before insert or update on public.boh_vault_collection_items
for each row execute function public.boh_vault_guard_syncable_item();

-- Reveal/copy is authorized against the exact item kind and owner before an
-- encrypted envelope can leave the database boundary.
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
  secret_version_id uuid, secret_version integer, ciphertext text, nonce text,
  wrapped_data_key text, secret_algorithm text, tenant_key_id uuid,
  wrapping_key_ref text, wrapped_key text, tenant_key_algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare secret_row record;
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
  if not public.boh_vault_user_can_access_item(
    requested_tenant_id, requested_item_id, requested_actor_boh_user_id,
    requested_environment, 'read'
  ) then
    raise exception 'Actor cannot access this Vault item' using errcode = '42501';
  end if;

  select version_row.id as secret_version_id, version_row.version as secret_version,
    version_row.ciphertext, version_row.nonce, version_row.wrapped_data_key,
    version_row.algorithm as secret_algorithm, key_row.id as tenant_key_id,
    key_row.wrapping_key_ref, key_row.wrapped_key,
    key_row.algorithm as tenant_key_algorithm
  into secret_row
  from public.boh_vault_items item
  join public.boh_vault_item_fields field
    on field.tenant_id=item.tenant_id and field.vault_item_id=item.id
   and field.id=requested_item_field_id and field.field_kind='protected'
  join public.boh_vault_secret_versions version_row
    on version_row.tenant_id=field.tenant_id and version_row.vault_item_id=field.vault_item_id
   and version_row.item_field_id=field.id and version_row.state='active'
  join public.boh_vault_tenant_keys key_row
    on key_row.tenant_id=version_row.tenant_id and key_row.id=version_row.tenant_key_id
  where item.tenant_id=requested_tenant_id and item.id=requested_item_id
    and item.environment=requested_environment and item.value_state <> 'disabled'
  for share of item, field, version_row, key_row;
  if not found then
    raise exception 'No active protected Vault value exists for the exact field' using errcode = 'P0002';
  end if;

  perform public.boh_vault_append_audit_event(
    requested_tenant_id, requested_item_id, requested_actor_boh_user_id,
    requested_service_identity, requested_audit_event, requested_request_id,
    requested_environment, 'secret_version', secret_row.secret_version_id,
    jsonb_build_object('item_field_id', requested_item_field_id, 'version', secret_row.secret_version)
  );

  return query select secret_row.secret_version_id, secret_row.secret_version,
    secret_row.ciphertext, secret_row.nonce, secret_row.wrapped_data_key,
    secret_row.secret_algorithm, secret_row.tenant_key_id, secret_row.wrapping_key_ref,
    secret_row.wrapped_key, secret_row.tenant_key_algorithm;
end;
$$;

-- Base-table REST reads and browser-safe views use the same item predicate.
drop policy if exists boh_vault_items_select on public.boh_vault_items;
create policy boh_vault_items_select on public.boh_vault_items for select to authenticated using (
  private.boh_vault_can_access_item(tenant_id, id, environment, 'read')
);

drop policy if exists boh_vault_item_fields_select on public.boh_vault_item_fields;
create policy boh_vault_item_fields_select on public.boh_vault_item_fields for select to authenticated using (
  exists (
    select 1 from public.boh_vault_items item
    where item.tenant_id=boh_vault_item_fields.tenant_id
      and item.id=boh_vault_item_fields.vault_item_id
      and private.boh_vault_can_access_item(item.tenant_id,item.id,item.environment,'read')
  )
);

drop policy if exists boh_vault_collection_items_select on public.boh_vault_collection_items;
create policy boh_vault_collection_items_select on public.boh_vault_collection_items for select to authenticated using (
  exists (
    select 1 from public.boh_vault_items item
    where item.tenant_id=boh_vault_collection_items.tenant_id
      and item.id=boh_vault_collection_items.vault_item_id
      and item.item_type<>'login'
      and private.boh_vault_current_user_has_role(
        item.tenant_id,array['vault_admin']::text[],item.environment
      )
  )
);

drop policy if exists boh_vault_collections_select on public.boh_vault_collections;
create policy boh_vault_collections_select on public.boh_vault_collections for select to authenticated using (
  private.boh_vault_current_user_has_role(tenant_id,array['vault_admin']::text[],environment)
);

drop policy if exists boh_vault_deployment_adapters_select on public.boh_vault_deployment_adapters;
create policy boh_vault_deployment_adapters_select on public.boh_vault_deployment_adapters
for select to authenticated using (
  exists (
    select 1 from public.boh_vault_access_grants grant_row
    where private.boh_vault_current_user_has_role(
      grant_row.tenant_id,array['vault_admin']::text[],grant_row.environment
    )
  )
);

drop policy if exists boh_vault_audit_events_select on public.boh_vault_audit_events;
create policy boh_vault_audit_events_select on public.boh_vault_audit_events for select to authenticated using (
  case when vault_item_id is null then
    private.boh_vault_current_user_has_role(tenant_id,array['vault_admin']::text[],environment)
  else private.boh_vault_can_access_item(tenant_id,vault_item_id,environment,'read') end
);

drop policy if exists boh_vault_deployment_targets_select on public.boh_vault_deployment_targets;
create policy boh_vault_deployment_targets_select on public.boh_vault_deployment_targets for select to authenticated using (
  private.boh_vault_current_user_has_role(tenant_id,array['vault_admin']::text[],environment)
);
drop policy if exists boh_vault_sync_bindings_select on public.boh_vault_sync_bindings;
create policy boh_vault_sync_bindings_select on public.boh_vault_sync_bindings for select to authenticated using (
  private.boh_vault_current_user_has_role(tenant_id,array['vault_admin']::text[],environment)
  and exists (
    select 1 from public.boh_vault_items item
    where item.tenant_id=boh_vault_sync_bindings.tenant_id
      and item.id=boh_vault_sync_bindings.vault_item_id
      and item.item_type<>'login'
  )
);
drop policy if exists boh_vault_sync_runs_select on public.boh_vault_sync_runs;
create policy boh_vault_sync_runs_select on public.boh_vault_sync_runs for select to authenticated using (
  private.boh_vault_current_user_has_role(tenant_id,array['vault_admin']::text[],environment)
  and exists (
    select 1 from public.boh_vault_items item
    where item.tenant_id=boh_vault_sync_runs.tenant_id
      and item.id=boh_vault_sync_runs.vault_item_id
      and item.item_type<>'login'
  )
);

create or replace view public.boh_vault_items_safe
with (security_barrier=true, security_invoker=true) as
select item.id,item.tenant_id,item.item_key,item.display_name,item.item_type,
  item.provider_key,item.purpose,item.environment,item.description,item.notes,
  item.value_state,item.validation_state,item.last_validated_at,item.last_rotated_at,
  item.rotation_due_at,item.owner_boh_user_id,item.created_at,item.updated_at
from public.boh_vault_items item
where item.value_state <> 'disabled'
  and private.boh_vault_can_access_item(item.tenant_id,item.id,item.environment,'read');

create or replace view public.boh_vault_access_grants_safe
with (security_barrier=true,security_invoker=true) as
select
  access_grant.id,access_grant.tenant_id,access_grant.boh_user_id,
  access_grant.role,access_grant.environment,access_grant.status,
  access_grant.expires_at,access_grant.granted_by,access_grant.revoked_by,
  access_grant.created_at,access_grant.updated_at
from public.boh_vault_access_grants access_grant
where access_grant.environment is not null
  and (
    private.boh_vault_current_user_has_role(
      access_grant.tenant_id,array['vault_admin']::text[],access_grant.environment
    )
    or (
      access_grant.boh_user_id=private.boh_vault_current_actor_id(access_grant.tenant_id)
      and private.boh_vault_current_user_has_role(
        access_grant.tenant_id,
        array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],
        access_grant.environment
      )
    )
  );

create or replace view public.boh_vault_item_fields_safe
with (security_barrier=true, security_invoker=true) as
select field.id,field.tenant_id,field.vault_item_id,field.field_key,field.label,
  field.field_kind,case when field.field_kind='plaintext' then field.plaintext_value else null end plaintext_value,
  field.is_required,field.sort_order,field.created_at,field.updated_at
from public.boh_vault_item_fields field
join public.boh_vault_items item on item.tenant_id=field.tenant_id and item.id=field.vault_item_id
where item.value_state <> 'disabled'
  and private.boh_vault_can_access_item(item.tenant_id,item.id,item.environment,'read');

create or replace view public.boh_vault_collection_items_safe
with (security_barrier=true, security_invoker=true) as
select membership.id,membership.tenant_id,membership.environment,
  membership.collection_id,membership.vault_item_id,membership.created_at
from public.boh_vault_collection_items membership
join public.boh_vault_items item on item.tenant_id=membership.tenant_id and item.id=membership.vault_item_id
where item.item_type<>'login'
  and private.boh_vault_current_user_has_role(
    item.tenant_id,array['vault_admin']::text[],item.environment
  );

create or replace view public.boh_vault_collections_safe
with (security_barrier=true, security_invoker=true) as
select collection.id,collection.tenant_id,collection.environment,
  collection.parent_collection_id,collection.name,collection.description,
  collection.status,collection.created_at,collection.updated_at
from public.boh_vault_collections collection
where private.boh_vault_current_user_has_role(
  collection.tenant_id,array['vault_admin']::text[],collection.environment
);

create or replace view public.boh_vault_deployment_adapters_safe
with (security_barrier=true, security_invoker=true) as
select adapter.id,adapter.adapter_key,adapter.display_name,adapter.adapter_version,
  adapter.description,adapter.capabilities,adapter.configuration_schema,adapter.status
from public.boh_vault_deployment_adapters adapter
where adapter.status='active'
  and exists (
    select 1 from public.boh_vault_access_grants grant_row
    where private.boh_vault_current_user_has_role(
      grant_row.tenant_id,array['vault_admin']::text[],grant_row.environment
    )
  );

create or replace view public.boh_vault_audit_events_safe
with (security_barrier=true, security_invoker=true) as
select event.id,event.tenant_id,event.vault_item_id,event.actor_boh_user_id,
  event.service_identity,event.event_type,event.request_id,event.environment,
  event.subject_type,event.subject_id,event.metadata,event.created_at
from public.boh_vault_audit_events event
where case when event.vault_item_id is null then
  private.boh_vault_current_user_has_role(event.tenant_id,array['vault_admin']::text[],event.environment)
else private.boh_vault_can_access_item(event.tenant_id,event.vault_item_id,event.environment,'read') end;

create or replace view public.boh_vault_deployment_targets_safe
with (security_barrier=true, security_invoker=true) as
select target.id,target.tenant_id,adapter.adapter_key,adapter.display_name adapter_name,
  target.target_key,target.display_name,target.environment,target.external_target_ref,
  target.status,target.last_checked_at,target.created_at,target.updated_at
from public.boh_vault_deployment_targets target
join public.boh_vault_deployment_adapters adapter on adapter.id=target.adapter_id
where private.boh_vault_current_user_has_role(target.tenant_id,array['vault_admin']::text[],target.environment);

create or replace view public.boh_vault_sync_bindings_safe
with (security_barrier=true, security_invoker=true) as
select binding.id,binding.tenant_id,binding.vault_item_id,binding.item_field_id,
  binding.deployment_target_id,binding.environment,binding.destination_key,binding.sync_mode,
  binding.state,binding.last_synced_secret_version_id,binding.last_synced_at,
  binding.created_at,binding.updated_at
from public.boh_vault_sync_bindings binding
join public.boh_vault_items item
  on item.tenant_id=binding.tenant_id and item.id=binding.vault_item_id
where item.item_type<>'login'
  and private.boh_vault_current_user_has_role(binding.tenant_id,array['vault_admin']::text[],binding.environment);

create or replace view public.boh_vault_sync_runs_safe
with (security_barrier=true, security_invoker=true) as
select run.id,run.tenant_id,run.binding_id,run.vault_item_id,run.item_field_id,
  run.secret_version_id,run.environment,run.status,run.attempt,run.request_id,
  run.result_code,run.started_at,run.completed_at,run.created_at
from public.boh_vault_sync_runs run
join public.boh_vault_items item
  on item.tenant_id=run.tenant_id and item.id=run.vault_item_id
where item.item_type<>'login'
  and private.boh_vault_current_user_has_role(run.tenant_id,array['vault_admin']::text[],run.environment);

-- Only the RPCs called by the three reviewed Edge Functions remain direct
-- service-role entry points. Internal helpers continue to execute as their owner.
revoke all on function public.boh_vault_append_audit_event(uuid,uuid,uuid,text,text,text,text,text,uuid,jsonb)
  from service_role;
revoke all on function public.boh_vault_require_service_actor(uuid,uuid,text)
  from service_role;
revoke all on function public.boh_vault_recompute_item_readiness(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.boh_vault_create_tenant_key(uuid,uuid,integer,text,text,uuid,text,text,text)
  from service_role;
revoke all on function public.boh_vault_transition_tenant_key(uuid,uuid,text,uuid,text,text,text)
  from service_role;
revoke all on function public.boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text)
  from service_role;
revoke all on function public.boh_vault_start_sync_run(uuid,uuid,uuid,text,text)
  from service_role;
revoke all on function public.boh_vault_cancel_sync_run(uuid,uuid,uuid,text,text)
  from service_role;

revoke all on table
  public.boh_vault_access_grants,
  public.boh_vault_collections,
  public.boh_vault_items,
  public.boh_vault_collection_items,
  public.boh_vault_item_fields,
  public.boh_vault_tenant_keys,
  public.boh_vault_secret_versions,
  public.boh_vault_audit_events,
  public.boh_vault_legacy_credential_bridge,
  public.boh_vault_deployment_adapters,
  public.boh_vault_deployment_targets,
  public.boh_vault_sync_bindings,
  public.boh_vault_sync_runs
from service_role;

-- Public functions default to EXECUTE for PUBLIC. Close every historical Vault
-- RPC and helper first, then expose only browser authorization helpers and the
-- exact RPCs called by the three reviewed Vault Edge Functions.
do $$
declare
  function_row record;
begin
  for function_row in
    select function_oid::regprocedure as signature
    from (
      select function_definition.oid as function_oid
      from pg_proc function_definition
      join pg_namespace function_schema on function_schema.oid=function_definition.pronamespace
      where function_schema.nspname='public'
        and function_definition.proname like 'boh_vault_%'
    ) functions
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      function_row.signature
    );
  end loop;
end;
$$;

grant execute on function public.boh_vault_upsert_item(uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_update_item_details_v2(uuid,uuid,text,text,text,text,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_upsert_item_field(uuid,uuid,uuid,text,text,text,text,text,boolean,integer,jsonb,uuid,text,text) to service_role;
grant execute on function public.boh_vault_archive_item(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_mutate_access_grant(uuid,uuid,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_create_deployment_target(uuid,uuid,text,text,text,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.boh_vault_create_sync_binding(uuid,uuid,uuid,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_update_sync_binding(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_request_active_sync_run(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.boh_vault_get_active_tenant_key_for_item(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.boh_vault_initialize_tenant_key_for_item(uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.boh_vault_read_secret_envelope(uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.boh_vault_claim_sync_run(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.boh_vault_complete_sync_run(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_fail_sync_run(uuid,uuid,text,uuid,text,text) to service_role;

comment on function public.boh_vault_user_can_access_item(uuid,uuid,uuid,text,text) is
  'Exact tenant/environment item authorization. Login items are creator-private and never syncable; operational credentials require vault_admin.';

commit;
