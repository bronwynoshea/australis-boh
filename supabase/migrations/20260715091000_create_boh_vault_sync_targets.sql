-- Provider-neutral BOH Vault deployment targets and exact protected-version synchronization.
begin;

create table public.boh_vault_deployment_adapters (
  id uuid primary key default gen_random_uuid(),
  adapter_key text not null unique check (btrim(adapter_key) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  adapter_version text not null default 'v1',
  description text,
  capabilities jsonb not null default '{}'::jsonb,
  configuration_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'disabled', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boh_vault_deployment_adapters_capabilities_guard check (not public.boh_vault_json_has_protected_key(capabilities)),
  constraint boh_vault_deployment_adapters_schema_guard check (not public.boh_vault_json_has_protected_key(configuration_schema)),
  constraint boh_vault_deployment_adapters_time_guard check (updated_at >= created_at)
);

create table public.boh_vault_deployment_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  adapter_id uuid not null references public.boh_vault_deployment_adapters(id) on delete restrict,
  target_key text not null check (btrim(target_key) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  environment text not null check (environment in ('development', 'production')),
  external_target_ref text,
  status text not null default 'active' check (status in ('active', 'disabled', 'error')),
  last_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, environment),
  unique (tenant_id, environment, target_key),
  constraint boh_vault_deployment_targets_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_deployment_targets_updated_by_fk foreign key (tenant_id, updated_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_deployment_targets_safe_metadata_guard check (not public.boh_vault_json_has_protected_key(metadata)),
  constraint boh_vault_deployment_targets_time_guard check (
    updated_at >= created_at and (last_checked_at is null or last_checked_at >= created_at)
  )
);
create index boh_vault_deployment_targets_adapter_idx on public.boh_vault_deployment_targets(adapter_id, status);

create table public.boh_vault_sync_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  vault_item_id uuid not null,
  item_field_id uuid not null,
  deployment_target_id uuid not null,
  environment text not null check (environment in ('development', 'production')),
  destination_key text not null check (btrim(destination_key) <> ''),
  sync_mode text not null default 'runtime_secret_sync' check (sync_mode in ('runtime_secret_sync', 'brokered_execution', 'scoped_lease')),
  state text not null default 'pending' check (state in ('pending', 'ready', 'blocked', 'disabled', 'error')),
  last_synced_secret_version_id uuid,
  last_synced_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, environment),
  unique (tenant_id, id, environment, vault_item_id, item_field_id),
  unique (tenant_id, deployment_target_id, destination_key),
  constraint boh_vault_sync_bindings_tenant_item_environment_fk foreign key (tenant_id, vault_item_id, environment)
    references public.boh_vault_items(tenant_id, id, environment) on delete cascade,
  constraint boh_vault_sync_bindings_exact_protected_field_fk foreign key (tenant_id, item_field_id, vault_item_id)
    references public.boh_vault_item_fields(tenant_id, id, vault_item_id) on delete restrict,
  constraint boh_vault_sync_bindings_tenant_target_environment_fk foreign key (tenant_id, deployment_target_id, environment)
    references public.boh_vault_deployment_targets(tenant_id, id, environment) on delete cascade,
  constraint boh_vault_sync_bindings_last_version_fk foreign key (
    tenant_id, last_synced_secret_version_id, vault_item_id, item_field_id
  ) references public.boh_vault_secret_versions(tenant_id, id, vault_item_id, item_field_id) on delete restrict,
  constraint boh_vault_sync_bindings_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_sync_bindings_updated_by_fk foreign key (tenant_id, updated_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_sync_bindings_sync_guard check (
    (last_synced_at is null and last_synced_secret_version_id is null)
    or (last_synced_at is not null and last_synced_secret_version_id is not null and last_synced_at >= created_at)
  ),
  constraint boh_vault_sync_bindings_time_guard check (updated_at >= created_at)
);
create index boh_vault_sync_bindings_item_field_idx on public.boh_vault_sync_bindings(tenant_id, vault_item_id, item_field_id, state);
create index boh_vault_sync_bindings_target_idx on public.boh_vault_sync_bindings(tenant_id, deployment_target_id, state);

create table public.boh_vault_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete restrict,
  binding_id uuid not null,
  vault_item_id uuid not null,
  item_field_id uuid not null,
  secret_version_id uuid not null,
  environment text not null check (environment in ('development', 'production')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  request_id text not null check (btrim(request_id) <> ''),
  service_identity text not null check (btrim(service_identity) <> ''),
  requested_by uuid not null,
  result_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, request_id),
  constraint boh_vault_sync_runs_exact_binding_fk foreign key (
    tenant_id, binding_id, environment, vault_item_id, item_field_id
  ) references public.boh_vault_sync_bindings(tenant_id, id, environment, vault_item_id, item_field_id) on delete restrict,
  constraint boh_vault_sync_runs_exact_version_fk foreign key (
    tenant_id, secret_version_id, vault_item_id, item_field_id
  ) references public.boh_vault_secret_versions(tenant_id, id, vault_item_id, item_field_id) on delete restrict,
  constraint boh_vault_sync_runs_requested_by_fk foreign key (tenant_id, requested_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_sync_runs_lifecycle_guard check (
    (status = 'queued' and started_at is null and completed_at is null and result_code is null)
    or (status = 'running' and started_at is not null and completed_at is null and result_code is null)
    or (status in ('succeeded','failed') and started_at is not null and completed_at is not null
        and completed_at >= started_at and btrim(coalesce(result_code, '')) <> '')
    or (status = 'cancelled' and completed_at is not null
        and (started_at is null or completed_at >= started_at) and btrim(coalesce(result_code, '')) <> '')
  ),
  constraint boh_vault_sync_runs_timestamp_guard check (
    created_at between transaction_timestamp() - interval '5 seconds' and transaction_timestamp() + interval '5 seconds'
    and (started_at is null or started_at >= created_at)
  )
);
create index boh_vault_sync_runs_binding_created_idx on public.boh_vault_sync_runs(tenant_id, binding_id, created_at desc);
create index boh_vault_sync_runs_version_idx on public.boh_vault_sync_runs(tenant_id, secret_version_id, created_at desc);

create or replace function public.boh_vault_require_protected_sync_binding()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.boh_vault_item_fields field
    where field.tenant_id = new.tenant_id and field.vault_item_id = new.vault_item_id
      and field.id = new.item_field_id and field.field_kind = 'protected'
  ) then
    raise exception 'Sync bindings require the exact protected item field' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_guard_deployment_target_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vault deployment targets cannot be deleted' using errcode = '55000';
  end if;
  if (new.tenant_id,new.adapter_id,new.target_key,new.environment,new.created_by,new.created_at)
     is distinct from
     (old.tenant_id,old.adapter_id,old.target_key,old.environment,old.created_by,old.created_at) then
    raise exception 'Vault deployment target identity is immutable' using errcode = '55000';
  end if;
  if old.status = 'disabled' and new.status <> 'disabled' then
    raise exception 'Disabled deployment targets cannot be re-enabled' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_guard_sync_binding_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vault sync bindings cannot be deleted' using errcode = '55000';
  end if;
  if (new.tenant_id,new.vault_item_id,new.item_field_id,new.deployment_target_id,new.environment,
      new.destination_key,new.sync_mode,new.created_by,new.created_at)
     is distinct from
     (old.tenant_id,old.vault_item_id,old.item_field_id,old.deployment_target_id,old.environment,
      old.destination_key,old.sync_mode,old.created_by,old.created_at) then
    raise exception 'Vault sync binding identity is immutable' using errcode = '55000';
  end if;
  if not ((old.state = 'pending' and new.state in ('pending','ready','blocked','disabled','error'))
       or (old.state = 'ready' and new.state in ('ready','blocked','disabled','error'))
       or (old.state in ('blocked','error') and new.state in ('pending','blocked','disabled','error'))
       or (old.state = 'disabled' and new.state = 'disabled')) then
    raise exception 'Invalid sync binding transition: % -> %', old.state, new.state using errcode = '22023';
  end if;
  if (new.last_synced_secret_version_id,new.last_synced_at) is distinct from
     (old.last_synced_secret_version_id,old.last_synced_at) then
    if new.state <> 'ready' or new.last_synced_secret_version_id is null or new.last_synced_at is null
       or (old.last_synced_at is not null and new.last_synced_at < old.last_synced_at) then
      raise exception 'Invalid exact last-synchronized version delta' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_guard_sync_run_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vault sync runs cannot be deleted' using errcode = '55000';
  end if;
  if (new.tenant_id,new.binding_id,new.vault_item_id,new.item_field_id,new.secret_version_id,new.environment,
      new.attempt,new.request_id,new.service_identity,new.requested_by,new.created_at)
     is distinct from
     (old.tenant_id,old.binding_id,old.vault_item_id,old.item_field_id,old.secret_version_id,old.environment,
      old.attempt,old.request_id,old.service_identity,old.requested_by,old.created_at) then
    raise exception 'Vault sync run identity is immutable' using errcode = '55000';
  end if;
  if old.status = 'queued' and new.status = 'running' then
    if old.started_at is not null or new.started_at is null or new.completed_at is not null or new.result_code is not null then
      raise exception 'Starting a run permits only status and started_at' using errcode = '55000';
    end if;
  elsif old.status = 'queued' and new.status = 'cancelled' then
    if new.started_at is not null or new.completed_at is null or btrim(coalesce(new.result_code,'')) = '' then
      raise exception 'Cancelling a queued run permits only terminal cancellation fields' using errcode = '55000';
    end if;
  elsif old.status = 'running' and new.status in ('succeeded','failed','cancelled') then
    if new.started_at is distinct from old.started_at or new.completed_at is null
       or btrim(coalesce(new.result_code,'')) = '' then
      raise exception 'Completing a running run permits only terminal result fields' using errcode = '55000';
    end if;
  elsif new is distinct from old then
    if new.status = old.status then
      raise exception 'Sync lifecycle timestamps and results are immutable outside an exact transition' using errcode = '55000';
    end if;
    raise exception 'Invalid sync run transition: % -> %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger boh_vault_deployment_adapters_updated_at before update on public.boh_vault_deployment_adapters
for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_deployment_targets_guard before update or delete on public.boh_vault_deployment_targets
for each row execute function public.boh_vault_guard_deployment_target_mutation();
create trigger boh_vault_deployment_targets_updated_at before update on public.boh_vault_deployment_targets
for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_sync_bindings_exact_protected_field before insert or update on public.boh_vault_sync_bindings
for each row execute function public.boh_vault_require_protected_sync_binding();
create trigger boh_vault_sync_bindings_guard before update or delete on public.boh_vault_sync_bindings
for each row execute function public.boh_vault_guard_sync_binding_mutation();
create trigger boh_vault_sync_bindings_updated_at before update on public.boh_vault_sync_bindings
for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_sync_runs_guard before update or delete on public.boh_vault_sync_runs
for each row execute function public.boh_vault_guard_sync_run_mutation();

-- All sync writes cross this service-only authorization boundary. Configuration
-- requires vault_admin; execution permits vault_admin or sync_operator in the exact environment.
create or replace function public.boh_vault_assert_sync_actor(
  requested_tenant_id uuid, requested_actor_boh_user_id uuid,
  requested_environment text, allowed_roles text[], requested_service_identity text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if requested_environment not in ('development','production')
     or btrim(coalesce(requested_service_identity,'')) = '' then
    raise exception 'Valid environment and service identity are required' using errcode = '22023';
  end if;
  if not public.boh_vault_user_has_role(
    requested_tenant_id, requested_actor_boh_user_id, allowed_roles, requested_environment
  ) then
    raise exception 'Actor is not authorized for this Vault tenant/environment' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.boh_vault_create_deployment_target(
  requested_tenant_id uuid, requested_adapter_id uuid, requested_target_key text,
  requested_display_name text, requested_environment text, requested_external_target_ref text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text,
  requested_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare created_id uuid;
begin
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    requested_environment,array['vault_admin']::text[],requested_service_identity);
  if btrim(coalesce(requested_target_key,'')) = '' or btrim(coalesce(requested_display_name,'')) = ''
     or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Target key, display name, and request ID are required' using errcode = '22023';
  end if;
  insert into public.boh_vault_deployment_targets(
    tenant_id,adapter_id,target_key,display_name,environment,external_target_ref,metadata,created_by,updated_by
  ) values (
    requested_tenant_id,requested_adapter_id,requested_target_key,requested_display_name,requested_environment,
    requested_external_target_ref,coalesce(requested_metadata,'{}'::jsonb),requested_actor_boh_user_id,requested_actor_boh_user_id
  ) returning id into created_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,null,requested_actor_boh_user_id,
    requested_service_identity,'deployment_target_created',requested_request_id,requested_environment,
    'deployment_target',created_id,jsonb_build_object('adapter_id',requested_adapter_id,'target_key',requested_target_key));
  return created_id;
end;
$$;

create or replace function public.boh_vault_update_deployment_target(
  requested_tenant_id uuid, requested_target_id uuid, requested_display_name text,
  requested_external_target_ref text, requested_status text, requested_last_checked_at timestamptz,
  requested_metadata jsonb, requested_actor_boh_user_id uuid, requested_service_identity text,
  requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare target_environment text;
begin
  select environment into target_environment from public.boh_vault_deployment_targets
  where tenant_id = requested_tenant_id and id = requested_target_id for update;
  if target_environment is null then raise exception 'Deployment target not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    target_environment,array['vault_admin']::text[],requested_service_identity);
  if requested_status not in ('active','disabled','error') or btrim(coalesce(requested_display_name,'')) = ''
     or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Valid target update and request ID are required' using errcode = '22023';
  end if;
  update public.boh_vault_deployment_targets set display_name=requested_display_name,
    external_target_ref=requested_external_target_ref,status=requested_status,last_checked_at=requested_last_checked_at,
    metadata=coalesce(requested_metadata,'{}'::jsonb),updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=requested_target_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,null,requested_actor_boh_user_id,
    requested_service_identity,'deployment_target_updated',requested_request_id,target_environment,
    'deployment_target',requested_target_id,jsonb_build_object('status',requested_status));
end;
$$;

create or replace function public.boh_vault_create_sync_binding(
  requested_tenant_id uuid, requested_item_id uuid, requested_field_id uuid,
  requested_target_id uuid, requested_environment text, requested_destination_key text,
  requested_sync_mode text, requested_actor_boh_user_id uuid, requested_service_identity text,
  requested_request_id text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare created_id uuid;
begin
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    requested_environment,array['vault_admin']::text[],requested_service_identity);
  if not exists (select 1 from public.boh_vault_item_fields field
    where field.tenant_id=requested_tenant_id and field.vault_item_id=requested_item_id
      and field.id=requested_field_id and field.field_kind='protected') then
    if exists (select 1 from public.boh_vault_item_fields where tenant_id=requested_tenant_id
      and id=requested_field_id and vault_item_id=requested_item_id) then
      raise exception 'Sync bindings require a protected field' using errcode = '23514';
    end if;
    raise exception 'Exact item field not found' using errcode = '23503';
  end if;
  if not exists (select 1 from public.boh_vault_deployment_targets
    where tenant_id=requested_tenant_id and id=requested_target_id and environment=requested_environment and status='active') then
    raise exception 'Exact active deployment target not found' using errcode = '23503';
  end if;
  if btrim(coalesce(requested_destination_key,'')) = '' or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Destination key and request ID are required' using errcode = '22023';
  end if;
  insert into public.boh_vault_sync_bindings(
    tenant_id,vault_item_id,item_field_id,deployment_target_id,environment,destination_key,sync_mode,created_by,updated_by
  ) values (
    requested_tenant_id,requested_item_id,requested_field_id,requested_target_id,requested_environment,
    requested_destination_key,requested_sync_mode,requested_actor_boh_user_id,requested_actor_boh_user_id
  ) returning id into created_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_binding_created',requested_request_id,requested_environment,
    'sync_binding',created_id,jsonb_build_object('field_id',requested_field_id,'target_id',requested_target_id));
  return created_id;
end;
$$;

create or replace function public.boh_vault_update_sync_binding(
  requested_tenant_id uuid, requested_binding_id uuid, requested_state text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare binding_row public.boh_vault_sync_bindings%rowtype;
begin
  select * into binding_row from public.boh_vault_sync_bindings
  where tenant_id=requested_tenant_id and id=requested_binding_id for update;
  if not found then raise exception 'Sync binding not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    binding_row.environment,array['vault_admin']::text[],requested_service_identity);
  if requested_state not in ('pending','ready','blocked','disabled','error')
     or btrim(coalesce(requested_request_id,'')) = '' then
    raise exception 'Valid binding state and request ID are required' using errcode = '22023';
  end if;
  update public.boh_vault_sync_bindings set state=requested_state,updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=requested_binding_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,binding_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_binding_updated',requested_request_id,binding_row.environment,
    'sync_binding',requested_binding_id,jsonb_build_object('state',requested_state,'field_id',binding_row.item_field_id));
end;
$$;

create or replace function public.boh_vault_request_sync_run(
  requested_tenant_id uuid, requested_binding_id uuid, requested_secret_version_id uuid,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text,
  requested_run_request_id text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare binding_row public.boh_vault_sync_bindings%rowtype; created_id uuid; next_attempt integer;
begin
  select * into binding_row from public.boh_vault_sync_bindings
  where tenant_id=requested_tenant_id and id=requested_binding_id for update;
  if not found or binding_row.state <> 'ready' then
    raise exception 'Ready sync binding not found' using errcode = '23503';
  end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    binding_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if not exists (select 1 from public.boh_vault_secret_versions version_row
    where version_row.tenant_id=requested_tenant_id and version_row.id=requested_secret_version_id
      and version_row.vault_item_id=binding_row.vault_item_id and version_row.item_field_id=binding_row.item_field_id
      and version_row.state='active') then
    raise exception 'Exact active secret version for binding not found' using errcode = '23503';
  end if;
  if btrim(coalesce(requested_request_id,'')) = '' or btrim(coalesce(requested_run_request_id,'')) = '' then
    raise exception 'Audit and run request IDs are required' using errcode = '22023';
  end if;
  select coalesce(max(attempt),0)+1 into next_attempt from public.boh_vault_sync_runs
  where tenant_id=requested_tenant_id and binding_id=requested_binding_id
    and secret_version_id=requested_secret_version_id;
  insert into public.boh_vault_sync_runs(
    tenant_id,binding_id,vault_item_id,item_field_id,secret_version_id,environment,
    attempt,request_id,service_identity,requested_by
  ) values (
    requested_tenant_id,requested_binding_id,binding_row.vault_item_id,binding_row.item_field_id,
    requested_secret_version_id,binding_row.environment,next_attempt,requested_run_request_id,
    requested_service_identity,requested_actor_boh_user_id
  ) returning id into created_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,binding_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_requested',requested_request_id,binding_row.environment,
    'sync_run',created_id,jsonb_build_object('binding_id',requested_binding_id,'field_id',binding_row.item_field_id,
      'version_id',requested_secret_version_id,'attempt',next_attempt));
  return created_id;
end;
$$;

create or replace function public.boh_vault_start_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_actor_boh_user_id uuid,
  requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype;
begin
  select * into run_row from public.boh_vault_sync_runs
  where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity <> run_row.service_identity then
    raise exception 'Run service identity mismatch' using errcode = '42501';
  end if;
  if run_row.status <> 'queued' then raise exception 'Only queued runs can start' using errcode = '22023'; end if;
  update public.boh_vault_sync_runs set status='running',started_at=transaction_timestamp()
  where tenant_id=requested_tenant_id and id=requested_run_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_started',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id));
end;
$$;

create or replace function public.boh_vault_complete_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_result_code text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype; completed_time timestamptz := transaction_timestamp();
begin
  select * into run_row from public.boh_vault_sync_runs
  where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity <> run_row.service_identity then raise exception 'Run service identity mismatch' using errcode='42501'; end if;
  if run_row.status <> 'running' or btrim(coalesce(requested_result_code,'')) = '' then
    raise exception 'Only running runs can complete with a result code' using errcode='22023';
  end if;
  update public.boh_vault_sync_runs set status='succeeded',completed_at=completed_time,result_code=requested_result_code
  where tenant_id=requested_tenant_id and id=requested_run_id;
  update public.boh_vault_sync_bindings set state='ready',last_synced_secret_version_id=run_row.secret_version_id,
    last_synced_at=completed_time,updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=run_row.binding_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_completed',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id,'result_code',requested_result_code));
end;
$$;

create or replace function public.boh_vault_fail_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_result_code text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype;
begin
  select * into run_row from public.boh_vault_sync_runs where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode='23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity <> run_row.service_identity then raise exception 'Run service identity mismatch' using errcode='42501'; end if;
  if run_row.status <> 'running' or btrim(coalesce(requested_result_code,'')) = '' then
    raise exception 'Only running runs can fail with a result code' using errcode='22023';
  end if;
  update public.boh_vault_sync_runs set status='failed',completed_at=transaction_timestamp(),result_code=requested_result_code
  where tenant_id=requested_tenant_id and id=requested_run_id;
  update public.boh_vault_sync_bindings set state='error',updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=run_row.binding_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_failed',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id,'result_code',requested_result_code));
end;
$$;

create or replace function public.boh_vault_cancel_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_actor_boh_user_id uuid,
  requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype;
begin
  select * into run_row from public.boh_vault_sync_runs where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode='23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity <> run_row.service_identity then raise exception 'Run service identity mismatch' using errcode='42501'; end if;
  if run_row.status not in ('queued','running') then raise exception 'Only queued or running runs can be cancelled' using errcode='22023'; end if;
  update public.boh_vault_sync_runs set status='cancelled',completed_at=transaction_timestamp(),result_code='cancelled'
  where tenant_id=requested_tenant_id and id=requested_run_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_cancelled',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id));
end;
$$;

alter table public.boh_vault_deployment_adapters enable row level security;
alter table public.boh_vault_deployment_targets enable row level security;
alter table public.boh_vault_sync_bindings enable row level security;
alter table public.boh_vault_sync_runs enable row level security;

create policy boh_vault_deployment_adapters_select on public.boh_vault_deployment_adapters for select to authenticated using (status <> 'disabled');
create policy boh_vault_deployment_targets_select on public.boh_vault_deployment_targets for select to authenticated using (
  public.boh_vault_has_role(tenant_id,array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],environment)
);
create policy boh_vault_sync_bindings_select on public.boh_vault_sync_bindings for select to authenticated using (
  public.boh_vault_has_role(tenant_id,array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],environment)
);
create policy boh_vault_sync_runs_select on public.boh_vault_sync_runs for select to authenticated using (
  public.boh_vault_has_role(tenant_id,array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],environment)
);

create view public.boh_vault_deployment_targets_safe with (security_barrier = true) as
select target.id,target.tenant_id,adapter.adapter_key,adapter.display_name as adapter_name,
  target.target_key,target.display_name,target.environment,target.external_target_ref,
  target.status,target.last_checked_at,target.created_at,target.updated_at
from public.boh_vault_deployment_targets target
join public.boh_vault_deployment_adapters adapter on adapter.id=target.adapter_id
where public.boh_vault_has_role(target.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],target.environment);

create view public.boh_vault_sync_bindings_safe with (security_barrier = true) as
select binding.id,binding.tenant_id,binding.vault_item_id,binding.item_field_id,binding.deployment_target_id,
  binding.environment,binding.destination_key,binding.sync_mode,binding.state,
  binding.last_synced_secret_version_id,binding.last_synced_at,binding.created_at,binding.updated_at
from public.boh_vault_sync_bindings binding
where public.boh_vault_has_role(binding.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],binding.environment);

create view public.boh_vault_sync_runs_safe with (security_barrier = true) as
select run.id,run.tenant_id,run.binding_id,run.vault_item_id,run.item_field_id,run.secret_version_id,
  run.environment,run.status,run.attempt,run.request_id,run.result_code,run.started_at,run.completed_at,run.created_at
from public.boh_vault_sync_runs run
where public.boh_vault_has_role(run.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],run.environment);

-- No caller, including service_role, receives base-table DML. SECURITY DEFINER RPCs
-- owned by the migration owner are the sole write path.
revoke all on table public.boh_vault_deployment_adapters from anon, authenticated, service_role;
revoke all on table public.boh_vault_deployment_targets from anon, authenticated, service_role;
revoke all on table public.boh_vault_sync_bindings from anon, authenticated, service_role;
revoke all on table public.boh_vault_sync_runs from anon, authenticated, service_role;
revoke all on table public.boh_vault_deployment_targets_safe from anon;
revoke all on table public.boh_vault_sync_bindings_safe from anon;
revoke all on table public.boh_vault_sync_runs_safe from anon;
grant select on public.boh_vault_deployment_targets_safe to authenticated;
grant select on public.boh_vault_sync_bindings_safe to authenticated;
grant select on public.boh_vault_sync_runs_safe to authenticated;

revoke all on function public.boh_vault_assert_sync_actor(uuid,uuid,text,text[],text) from public,anon,authenticated,service_role;
revoke all on function public.boh_vault_create_deployment_target(uuid,uuid,text,text,text,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.boh_vault_update_deployment_target(uuid,uuid,text,text,text,timestamptz,jsonb,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_create_sync_binding(uuid,uuid,uuid,uuid,text,text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_update_sync_binding(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_start_sync_run(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_complete_sync_run(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_fail_sync_run(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.boh_vault_cancel_sync_run(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.boh_vault_create_deployment_target(uuid,uuid,text,text,text,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.boh_vault_update_deployment_target(uuid,uuid,text,text,text,timestamptz,jsonb,uuid,text,text) to service_role;
grant execute on function public.boh_vault_create_sync_binding(uuid,uuid,uuid,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_update_sync_binding(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_request_sync_run(uuid,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.boh_vault_start_sync_run(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.boh_vault_complete_sync_run(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_fail_sync_run(uuid,uuid,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_cancel_sync_run(uuid,uuid,uuid,text,text) to service_role;

comment on table public.boh_vault_deployment_adapters is 'Provider-neutral adapter registry; adapter_key is unconstrained data.';
comment on table public.boh_vault_sync_bindings is 'Exact tenant/item/protected-field destination binding with an exact last-synchronized version reference.';
comment on table public.boh_vault_sync_runs is 'Exact protected-version synchronization attempts with controlled audited lifecycle and no raw payloads.';

commit;
