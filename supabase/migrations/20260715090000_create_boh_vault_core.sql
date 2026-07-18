-- BOH Vault tenant-scoped core.
-- Ordinary item notes/descriptions remain plaintext. Only explicitly protected
-- fields are versioned ciphertext and may be committed by the service boundary.
begin;

create or replace function public.boh_vault_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.boh_vault_reject_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

-- CASE-wrapped set-returning calls are safe for scalar JSON nodes. Key matching
-- normalizes snake_case, kebab-case, and camelCase. Bearer credentials are also
-- rejected when hidden in scalar values rather than object keys.
create or replace function public.boh_vault_json_has_protected_key(document jsonb)
returns boolean language sql immutable strict set search_path = public, pg_temp as $$
  with recursive nodes(value) as (
    select document
    union all
    select child.value
    from nodes n
    cross join lateral (
      select value
      from jsonb_each(case when jsonb_typeof(n.value) = 'object' then n.value else '{}'::jsonb end)
      union all
      select value
      from jsonb_array_elements(case when jsonb_typeof(n.value) = 'array' then n.value else '[]'::jsonb end)
    ) child
  ), object_keys(key) as (
    select key
    from nodes n
    cross join lateral jsonb_object_keys(
      case when jsonb_typeof(n.value) = 'object' then n.value else '{}'::jsonb end
    ) key
  )
  select exists (
    select 1
    from object_keys
    where regexp_replace(lower(key), '[^a-z0-9]', '', 'g') ~
      '(secret|password|passwd|token|apikey|privatekey|signingkey|rawvalue|plaintext|ciphertext|nonce|wrappedkey|wrappeddatakey|authorization|credential)'
  ) or exists (
    select 1
    from nodes
    where jsonb_typeof(value) = 'string'
      and trim(both '"' from value::text) ~* '(^|[[:space:]])(bearer|basic)[[:space:]]+[A-Za-z0-9._~+/=-]+'
  )
$$;

create or replace function public.boh_vault_plaintext_is_safe(field_key text, label text, plaintext_value text)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select case
    when plaintext_value is null then true
    when regexp_replace(lower(coalesce(field_key, '') || coalesce(label, '')), '[^a-z0-9]', '', 'g') ~
      '(secret|password|passwd|token|apikey|privatekey|authorization|credential|recoverycode)'
      then false
    when plaintext_value ~* '(^|[[:space:]])(bearer|basic)[[:space:]]+[A-Za-z0-9._~+/=-]+'
      then false
    else true
  end
$$;

create or replace function public.boh_vault_reject_unsafe_metadata()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if public.boh_vault_json_has_protected_key(new.metadata) then
    raise exception 'metadata contains protected-value material' using errcode = '22023';
  end if;
  return new;
end;
$$;

create table public.boh_vault_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  boh_user_id uuid not null,
  role text not null check (role in ('vault_admin', 'vault_editor', 'vault_viewer', 'sync_operator')),
  environment text check (environment in ('development', 'production')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'expired')),
  expires_at timestamptz,
  granted_by uuid,
  revoked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  constraint boh_vault_access_grants_member_fk foreign key (tenant_id, boh_user_id)
    references public.boh_tenant_member(tenant_id, user_id) on delete cascade,
  constraint boh_vault_access_grants_granted_by_fk foreign key (tenant_id, granted_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_access_grants_revoked_by_fk foreign key (tenant_id, revoked_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_access_grants_expiry_guard check (
    (status = 'expired' and expires_at is not null and expires_at <= now())
    or (status <> 'expired' and (expires_at is null or expires_at > created_at))
  ),
  constraint boh_vault_access_grants_revocation_guard check (
    (status = 'revoked' and revoked_by is not null) or (status <> 'revoked' and revoked_by is null)
  ),
  constraint boh_vault_access_grants_time_guard check (updated_at >= created_at)
);
create unique index boh_vault_access_grants_active_scope_uidx
  on public.boh_vault_access_grants (tenant_id, boh_user_id, role, coalesce(environment, '*')) where status = 'active';
create index boh_vault_access_grants_user_idx on public.boh_vault_access_grants (boh_user_id, tenant_id);

create table public.boh_vault_collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  environment text not null check (environment in ('development', 'production')),
  parent_collection_id uuid,
  name text not null check (btrim(name) <> ''),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, environment),
  constraint boh_vault_collections_tenant_parent_fk foreign key (tenant_id, parent_collection_id, environment)
    references public.boh_vault_collections(tenant_id, id, environment) on delete cascade,
  constraint boh_vault_collections_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_collections_updated_by_fk foreign key (tenant_id, updated_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_collections_not_self_parent check (parent_collection_id is null or parent_collection_id <> id),
  constraint boh_vault_collections_time_guard check (updated_at >= created_at)
);
create unique index boh_vault_collections_root_name_uidx
  on public.boh_vault_collections(tenant_id, environment, lower(name)) where parent_collection_id is null;
create unique index boh_vault_collections_child_name_uidx
  on public.boh_vault_collections(tenant_id, environment, parent_collection_id, lower(name)) where parent_collection_id is not null;
create index boh_vault_collections_tenant_idx on public.boh_vault_collections(tenant_id, environment, status);

create table public.boh_vault_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  item_key text not null check (btrim(item_key) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  item_type text not null default 'credential' check (item_type in ('credential', 'login', 'recovery_record', 'ssh_key', 'certificate', 'other')),
  provider_key text,
  purpose text,
  environment text not null check (environment in ('development', 'production')),
  description text,
  notes text,
  value_state text not null default 'needs_setup' check (value_state in ('needs_setup', 'configured', 'rotating', 'disabled', 'error')),
  validation_state text not null default 'unchecked' check (validation_state in ('unchecked', 'valid', 'invalid', 'unreachable', 'expired')),
  last_validated_at timestamptz,
  last_rotated_at timestamptz,
  rotation_due_at timestamptz,
  owner_boh_user_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, environment),
  unique (tenant_id, environment, item_key),
  constraint boh_vault_items_owner_fk foreign key (tenant_id, owner_boh_user_id)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_items_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_items_updated_by_fk foreign key (tenant_id, updated_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_items_time_guard check (
    updated_at >= created_at
    and (last_validated_at is null or last_validated_at >= created_at)
    and (last_rotated_at is null or last_rotated_at >= created_at)
    and (rotation_due_at is null or rotation_due_at >= created_at)
  )
);
create index boh_vault_items_tenant_state_idx on public.boh_vault_items(tenant_id, environment, value_state);
create index boh_vault_items_provider_idx on public.boh_vault_items(tenant_id, provider_key) where provider_key is not null;

create table public.boh_vault_collection_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  environment text not null check (environment in ('development', 'production')),
  collection_id uuid not null,
  vault_item_id uuid not null,
  added_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, environment, collection_id, vault_item_id),
  constraint boh_vault_collection_items_tenant_collection_fk foreign key (tenant_id, collection_id, environment)
    references public.boh_vault_collections(tenant_id, id, environment) on delete cascade,
  constraint boh_vault_collection_items_tenant_item_fk foreign key (tenant_id, vault_item_id, environment)
    references public.boh_vault_items(tenant_id, id, environment) on delete cascade,
  constraint boh_vault_collection_items_added_by_fk foreign key (tenant_id, added_by)
    references public.boh_tenant_member(tenant_id, user_id)
);
create index boh_vault_collection_items_item_idx on public.boh_vault_collection_items(tenant_id, environment, vault_item_id);

create table public.boh_vault_item_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  vault_item_id uuid not null,
  field_key text not null check (btrim(field_key) <> ''),
  label text not null check (btrim(label) <> ''),
  field_kind text not null check (field_kind in ('plaintext', 'protected')),
  plaintext_value text,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, vault_item_id),
  unique (tenant_id, vault_item_id, field_key),
  constraint boh_vault_item_fields_tenant_item_fk foreign key (tenant_id, vault_item_id)
    references public.boh_vault_items(tenant_id, id) on delete cascade,
  constraint boh_vault_item_fields_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_item_fields_updated_by_fk foreign key (tenant_id, updated_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_item_fields_plaintext_guard check (
    case
      when field_kind = 'protected' then plaintext_value is null
      else public.boh_vault_plaintext_is_safe(field_key, label, plaintext_value)
    end
  ),
  constraint boh_vault_item_fields_safe_metadata_guard check (not public.boh_vault_json_has_protected_key(metadata)),
  constraint boh_vault_item_fields_time_guard check (updated_at >= created_at)
);
create index boh_vault_item_fields_item_idx on public.boh_vault_item_fields(tenant_id, vault_item_id, sort_order);

create table public.boh_vault_tenant_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  key_version integer not null check (key_version > 0),
  wrapping_key_ref text not null check (btrim(wrapping_key_ref) <> ''),
  wrapped_key text not null check (btrim(wrapped_key) <> ''),
  algorithm text not null default 'AES-256-GCM' check (algorithm = 'AES-256-GCM'),
  state text not null default 'pending' check (state in ('pending', 'active', 'retired', 'revoked')),
  activated_at timestamptz,
  retired_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key_version),
  constraint boh_vault_tenant_keys_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_tenant_keys_timestamp_guard check (
    (activated_at is null or activated_at >= created_at)
    and (retired_at is null or retired_at >= coalesce(activated_at, created_at))
    and (state <> 'active' or activated_at is not null)
    and (state not in ('retired','revoked') or retired_at is not null)
  )
);
create unique index boh_vault_tenant_keys_one_active_idx on public.boh_vault_tenant_keys(tenant_id) where state = 'active';

create table public.boh_vault_secret_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  vault_item_id uuid not null,
  item_field_id uuid not null,
  tenant_key_id uuid not null,
  version integer not null check (version > 0),
  ciphertext text not null check (btrim(ciphertext) <> ''),
  nonce text not null check (btrim(nonce) <> ''),
  wrapped_data_key text not null check (btrim(wrapped_data_key) <> ''),
  algorithm text not null default 'AES-256-GCM' check (algorithm = 'AES-256-GCM'),
  state text not null default 'pending' check (state in ('pending', 'active', 'superseded', 'revoked')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  superseded_at timestamptz,
  revoked_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, id, vault_item_id, item_field_id),
  unique (tenant_id, item_field_id, version),
  constraint boh_vault_secret_versions_exact_field_fk foreign key (tenant_id, item_field_id, vault_item_id)
    references public.boh_vault_item_fields(tenant_id, id, vault_item_id) on delete restrict,
  constraint boh_vault_secret_versions_tenant_item_fk foreign key (tenant_id, vault_item_id)
    references public.boh_vault_items(tenant_id, id) on delete restrict,
  constraint boh_vault_secret_versions_tenant_key_fk foreign key (tenant_id, tenant_key_id)
    references public.boh_vault_tenant_keys(tenant_id, id) on delete restrict,
  constraint boh_vault_secret_versions_created_by_fk foreign key (tenant_id, created_by)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_secret_versions_timestamp_guard check (
    (activated_at is null or activated_at >= created_at)
    and (superseded_at is null or superseded_at >= coalesce(activated_at, created_at))
    and (revoked_at is null or revoked_at >= coalesce(activated_at, created_at))
    and (state <> 'active' or activated_at is not null)
    and (state <> 'superseded' or superseded_at is not null)
    and (state <> 'revoked' or revoked_at is not null)
  )
);
create unique index boh_vault_secret_versions_one_active_idx
  on public.boh_vault_secret_versions(tenant_id, item_field_id) where state = 'active';
create index boh_vault_secret_versions_item_idx on public.boh_vault_secret_versions(tenant_id, vault_item_id, created_at desc);

create table public.boh_vault_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete restrict,
  vault_item_id uuid,
  actor_boh_user_id uuid,
  service_identity text not null check (btrim(service_identity) <> ''),
  event_type text not null check (event_type in (
    'secret_version_committed','secret_version_superseded','secret_version_revoked',
    'revealed','copied','rotated','sync_requested','sync_started','sync_completed','sync_failed','sync_cancelled',
    'sync_binding_created','sync_binding_updated','deployment_target_created','deployment_target_updated',
    'legacy_metadata_imported',
    'grant_created','grant_updated','grant_revoked',
    'item_created','item_updated','field_created','field_updated',
    'collection_created','collection_updated','collection_membership_added','collection_membership_removed',
    'tenant_key_created','tenant_key_activated','tenant_key_retired','tenant_key_revoked'
  )),
  request_id text,
  environment text not null check (environment in ('development', 'production')),
  subject_type text not null check (btrim(subject_type) <> ''),
  subject_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint boh_vault_audit_events_tenant_item_environment_fk foreign key (tenant_id, vault_item_id, environment)
    references public.boh_vault_items(tenant_id, id, environment) on delete restrict,
  constraint boh_vault_audit_events_actor_fk foreign key (tenant_id, actor_boh_user_id)
    references public.boh_tenant_member(tenant_id, user_id),
  constraint boh_vault_audit_events_time_guard check (created_at between transaction_timestamp() - interval '5 seconds' and transaction_timestamp() + interval '5 seconds')
);
create index boh_vault_audit_events_tenant_created_idx on public.boh_vault_audit_events(tenant_id, created_at desc);
create index boh_vault_audit_events_item_idx on public.boh_vault_audit_events(tenant_id, vault_item_id, created_at desc);
create unique index boh_vault_audit_events_request_uidx
  on public.boh_vault_audit_events(tenant_id, request_id, event_type) where request_id is not null;

create or replace function public.boh_vault_current_user_id(requested_tenant_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select bu.id
  from public.boh_user bu
  where bu.auth_user_id = (select auth.uid())
    and bu.app_context = 'boh'
    and bu.status = 'active'
    and bu.tenant_id = requested_tenant_id
  order by bu.created_at asc nulls last
  limit 1
$$;

create or replace function public.boh_vault_user_has_role(
  requested_tenant_id uuid,
  requested_boh_user_id uuid,
  allowed_roles text[],
  requested_environment text default null
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.boh_tenant tenant
    join public.boh_tenant_member member on member.tenant_id = tenant.id
    join public.boh_user user_row on user_row.id = member.user_id and user_row.tenant_id = member.tenant_id
    join public.boh_vault_access_grants grant_row
      on grant_row.tenant_id = member.tenant_id and grant_row.boh_user_id = member.user_id
    join public.boh_app app on app.slug = 'vault' and app.app_context = 'boh' and app.is_active
    join public.boh_tenant_app tenant_app on tenant_app.tenant_id = tenant.id and tenant_app.app_id = app.id
    where tenant.id = requested_tenant_id
      and tenant.status = 'active'
      and user_row.id = requested_boh_user_id
      and user_row.status = 'active'
      and user_row.app_context = 'boh'
      and member.membership_status = 'active'
      and tenant_app.status = 'enabled'
      and grant_row.status = 'active'
      and (grant_row.expires_at is null or grant_row.expires_at > now())
      and grant_row.role = any(allowed_roles)
      and (grant_row.environment is null or grant_row.environment = requested_environment)
  )
$$;

create or replace function public.boh_vault_has_role(
  requested_tenant_id uuid,
  allowed_roles text[],
  requested_environment text default null
)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.boh_vault_user_has_role(
    requested_tenant_id,
    public.boh_vault_current_user_id(requested_tenant_id),
    allowed_roles,
    requested_environment
  )
$$;

create or replace function public.boh_vault_guard_tenant_key_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'Vault key records cannot be deleted' using errcode = '55000'; end if;
  if tg_op = 'INSERT' then
    if new.state = 'pending' and (new.activated_at is not null or new.retired_at is not null) then
      raise exception 'Pending Vault keys cannot carry lifecycle timestamps' using errcode = '22023';
    elsif new.state = 'active' and (new.activated_at is distinct from transaction_timestamp() or new.retired_at is not null) then
      raise exception 'Active Vault keys require the server activation timestamp only' using errcode = '22023';
    elsif new.state in ('retired','revoked') then
      raise exception 'Terminal Vault keys must be reached by transition' using errcode = '22023';
    end if;
    return new;
  end if;
  if (new.tenant_id, new.key_version, new.wrapping_key_ref, new.wrapped_key, new.algorithm, new.created_by, new.created_at)
     is distinct from
     (old.tenant_id, old.key_version, old.wrapping_key_ref, old.wrapped_key, old.algorithm, old.created_by, old.created_at) then
    raise exception 'Vault key cryptographic payload and identity are immutable' using errcode = '55000';
  end if;
  if old.state in ('retired','revoked') then
    raise exception 'Terminal Vault key records are immutable' using errcode = '55000';
  end if;
  if old.state = new.state then
    if (new.activated_at, new.retired_at) is distinct from (old.activated_at, old.retired_at) then
      raise exception 'Vault key lifecycle timestamps are immutable' using errcode = '55000';
    end if;
    return new;
  end if;
  if old.state = 'pending' and new.state = 'active' then
    if old.activated_at is not null or old.retired_at is not null
       or new.activated_at is distinct from transaction_timestamp() or new.retired_at is not null then
      raise exception 'Vault key activation requires the exact server timestamp delta' using errcode = '22023';
    end if;
  elsif old.state in ('pending','active') and new.state in ('retired','revoked') then
    if new.activated_at is distinct from old.activated_at
       or old.retired_at is not null or new.retired_at is distinct from transaction_timestamp() then
      raise exception 'Vault key termination requires the exact server timestamp delta' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid Vault key state transition: % -> %', old.state, new.state using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_guard_secret_version_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'Vault secret versions cannot be deleted' using errcode = '55000'; end if;
  if tg_op = 'INSERT' then
    if new.state = 'pending' and (new.activated_at is not null or new.superseded_at is not null or new.revoked_at is not null) then
      raise exception 'Pending Vault versions cannot carry lifecycle timestamps' using errcode = '22023';
    elsif new.state = 'active' and (new.activated_at is distinct from transaction_timestamp()
          or new.superseded_at is not null or new.revoked_at is not null) then
      raise exception 'Active Vault versions require the server activation timestamp only' using errcode = '22023';
    elsif new.state in ('superseded','revoked') then
      raise exception 'Terminal Vault versions must be reached by transition' using errcode = '22023';
    end if;
    return new;
  end if;
  if (new.tenant_id, new.vault_item_id, new.item_field_id, new.tenant_key_id, new.version,
      new.ciphertext, new.nonce, new.wrapped_data_key, new.algorithm, new.created_by, new.created_at)
     is distinct from
     (old.tenant_id, old.vault_item_id, old.item_field_id, old.tenant_key_id, old.version,
      old.ciphertext, old.nonce, old.wrapped_data_key, old.algorithm, old.created_by, old.created_at) then
    raise exception 'Vault secret cryptographic payload and identity are immutable' using errcode = '55000';
  end if;
  if old.state in ('superseded','revoked') then
    raise exception 'Terminal Vault secret versions are immutable' using errcode = '55000';
  end if;
  if old.state = new.state then
    if (new.activated_at, new.superseded_at, new.revoked_at)
       is distinct from (old.activated_at, old.superseded_at, old.revoked_at) then
      raise exception 'Vault secret lifecycle timestamps are immutable' using errcode = '55000';
    end if;
    return new;
  end if;
  if old.state = 'pending' and new.state = 'active' then
    if new.activated_at is distinct from transaction_timestamp()
       or new.superseded_at is not null or new.revoked_at is not null then
      raise exception 'Vault secret activation requires the exact server timestamp delta' using errcode = '22023';
    end if;
  elsif old.state = 'active' and new.state = 'superseded' then
    if new.activated_at is distinct from old.activated_at or old.superseded_at is not null
       or new.superseded_at is distinct from transaction_timestamp() or new.revoked_at is distinct from old.revoked_at then
      raise exception 'Vault secret supersession requires the exact server timestamp delta' using errcode = '22023';
    end if;
  elsif old.state in ('pending','active') and new.state = 'revoked' then
    if new.activated_at is distinct from old.activated_at or new.superseded_at is distinct from old.superseded_at
       or old.revoked_at is not null or new.revoked_at is distinct from transaction_timestamp() then
      raise exception 'Vault secret revocation requires the exact server timestamp delta' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid Vault secret state transition: % -> %', old.state, new.state using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_require_protected_secret_field()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.boh_vault_item_fields field
    where field.tenant_id = new.tenant_id and field.vault_item_id = new.vault_item_id
      and field.id = new.item_field_id and field.field_kind = 'protected'
  ) then
    raise exception 'Secret versions require the exact protected field' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_prevent_protected_field_downgrade()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.field_kind = 'protected' and new.field_kind <> 'protected' and exists (
    select 1 from public.boh_vault_secret_versions version_row
    where version_row.tenant_id = old.tenant_id and version_row.item_field_id = old.id
  ) then
    raise exception 'A versioned protected field cannot become plaintext' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_force_audit_timestamp()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.created_at := transaction_timestamp(); return new; end;
$$;

create or replace function public.boh_vault_append_audit_event(
  requested_tenant_id uuid, requested_item_id uuid, requested_actor_boh_user_id uuid,
  requested_service_identity text, requested_event_type text, requested_request_id text,
  requested_environment text, requested_subject_type text, requested_subject_id uuid,
  requested_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare appended_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if requested_actor_boh_user_id is not null and not public.boh_vault_user_has_role(
      requested_tenant_id, requested_actor_boh_user_id,
      array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], requested_environment) then
    raise exception 'Audit actor is not authorized for this tenant/environment' using errcode = '42501';
  end if;
  insert into public.boh_vault_audit_events(
    tenant_id,vault_item_id,actor_boh_user_id,service_identity,event_type,request_id,
    environment,subject_type,subject_id,metadata
  ) values (
    requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,requested_event_type,requested_request_id,
    requested_environment,requested_subject_type,requested_subject_id,coalesce(requested_metadata,'{}'::jsonb)
  ) returning id into appended_id;
  return appended_id;
end;
$$;

create or replace function public.boh_vault_require_service_actor(
  requested_tenant_id uuid, requested_actor_boh_user_id uuid, requested_environment text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if requested_environment not in ('development','production') then
    raise exception 'A canonical Vault environment is required' using errcode = '22023';
  end if;
  if not public.boh_vault_user_has_role(requested_tenant_id, requested_actor_boh_user_id,
      array['vault_admin']::text[], requested_environment) then
    raise exception 'Actor is not an authorized Vault admin for this tenant/environment' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.boh_vault_mutate_access_grant(
  requested_grant_id uuid, requested_tenant_id uuid, requested_boh_user_id uuid,
  requested_role text, requested_environment text, requested_status text,
  requested_actor_boh_user_id uuid, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  event_name text;
  existing_grant public.boh_vault_access_grants%rowtype;
begin
  perform public.boh_vault_require_service_actor(
    requested_tenant_id, requested_actor_boh_user_id, requested_environment
  );
  if requested_status not in ('active','suspended','revoked') then
    raise exception 'Unsupported grant mutation status' using errcode = '22023';
  end if;

  select * into existing_grant
  from public.boh_vault_access_grants
  where tenant_id = requested_tenant_id and id = requested_grant_id
  for update;

  if found then
    if existing_grant.boh_user_id <> requested_boh_user_id then
      raise exception 'Grant grantee identity is immutable' using errcode = '22023';
    end if;
    if existing_grant.environment is null then
      raise exception 'Environment-unrestricted grants require a separate reviewed migration' using errcode = '42501';
    end if;
    perform public.boh_vault_require_service_actor(
      requested_tenant_id, requested_actor_boh_user_id, existing_grant.environment
    );
    update public.boh_vault_access_grants
      set role = requested_role,
          environment = requested_environment,
          status = requested_status,
          revoked_by = case when requested_status = 'revoked' then requested_actor_boh_user_id else null end
      where tenant_id = requested_tenant_id
        and id = requested_grant_id
        and boh_user_id = requested_boh_user_id;
    event_name := case when requested_status = 'revoked' then 'grant_revoked' else 'grant_updated' end;
  else
    if requested_status <> 'active' then
      raise exception 'New grants must be active' using errcode = '22023';
    end if;
    insert into public.boh_vault_access_grants(
      id,tenant_id,boh_user_id,role,environment,status,granted_by
    ) values (
      requested_grant_id,requested_tenant_id,requested_boh_user_id,requested_role,
      requested_environment,'active',requested_actor_boh_user_id
    );
    event_name := 'grant_created';
  end if;

  perform public.boh_vault_append_audit_event(
    requested_tenant_id,null,requested_actor_boh_user_id,requested_service_identity,
    event_name,requested_request_id,requested_environment,'access_grant',requested_grant_id,
    jsonb_build_object('role',requested_role,'status',requested_status,'grantee_id',requested_boh_user_id)
  );
  return requested_grant_id;
end;
$$;

create or replace function public.boh_vault_upsert_collection(
  requested_collection_id uuid, requested_tenant_id uuid, requested_environment text,
  requested_parent_collection_id uuid, requested_name text, requested_description text, requested_status text,
  requested_actor_boh_user_id uuid, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare existed boolean;
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  select exists(select 1 from public.boh_vault_collections where tenant_id=requested_tenant_id and id=requested_collection_id) into existed;
  if existed then
    update public.boh_vault_collections set parent_collection_id=requested_parent_collection_id,
      name=requested_name,description=requested_description,status=requested_status,updated_by=requested_actor_boh_user_id
      where tenant_id=requested_tenant_id and id=requested_collection_id and environment=requested_environment;
    if not found then raise exception 'Collection environment is immutable' using errcode='23503'; end if;
  else
    insert into public.boh_vault_collections(id,tenant_id,environment,parent_collection_id,name,description,status,created_by,updated_by)
      values(requested_collection_id,requested_tenant_id,requested_environment,requested_parent_collection_id,
        requested_name,requested_description,requested_status,requested_actor_boh_user_id,requested_actor_boh_user_id);
  end if;
  perform public.boh_vault_append_audit_event(requested_tenant_id,null,requested_actor_boh_user_id,
    requested_service_identity,case when existed then 'collection_updated' else 'collection_created' end,
    requested_request_id,requested_environment,'collection',requested_collection_id,
    jsonb_build_object('status',requested_status,'parent_collection_id',requested_parent_collection_id));
  return requested_collection_id;
end;
$$;

create or replace function public.boh_vault_set_collection_membership(
  requested_membership_id uuid, requested_tenant_id uuid, requested_environment text,
  requested_collection_id uuid, requested_item_id uuid, requested_present boolean,
  requested_actor_boh_user_id uuid, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  if requested_present then
    insert into public.boh_vault_collection_items(id,tenant_id,environment,collection_id,vault_item_id,added_by)
      values(requested_membership_id,requested_tenant_id,requested_environment,requested_collection_id,requested_item_id,requested_actor_boh_user_id);
  else
    delete from public.boh_vault_collection_items where tenant_id=requested_tenant_id
      and environment=requested_environment and id=requested_membership_id
      and collection_id=requested_collection_id and vault_item_id=requested_item_id;
    if not found then raise exception 'Exact collection membership not found' using errcode='23503'; end if;
  end if;
  perform public.boh_vault_append_audit_event(requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,case when requested_present then 'collection_membership_added' else 'collection_membership_removed' end,
    requested_request_id,requested_environment,'collection_membership',requested_membership_id,
    jsonb_build_object('collection_id',requested_collection_id,'item_id',requested_item_id));
  return requested_membership_id;
end;
$$;

create or replace function public.boh_vault_upsert_item(
  requested_item_id uuid, requested_tenant_id uuid, requested_item_key text, requested_display_name text,
  requested_item_type text, requested_provider_key text, requested_purpose text, requested_environment text,
  requested_description text, requested_notes text, requested_actor_boh_user_id uuid,
  requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare existed boolean;
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  select exists(select 1 from public.boh_vault_items where tenant_id=requested_tenant_id and id=requested_item_id) into existed;
  if existed then
    update public.boh_vault_items set item_key=requested_item_key,display_name=requested_display_name,
      item_type=requested_item_type,provider_key=requested_provider_key,purpose=requested_purpose,
      description=requested_description,notes=requested_notes,updated_by=requested_actor_boh_user_id
      where tenant_id=requested_tenant_id and id=requested_item_id and environment=requested_environment;
    if not found then raise exception 'Item environment is immutable' using errcode='23503'; end if;
  else
    insert into public.boh_vault_items(id,tenant_id,item_key,display_name,item_type,provider_key,purpose,environment,
      description,notes,created_by,updated_by) values(requested_item_id,requested_tenant_id,requested_item_key,
      requested_display_name,requested_item_type,requested_provider_key,requested_purpose,requested_environment,
      requested_description,requested_notes,requested_actor_boh_user_id,requested_actor_boh_user_id);
  end if;
  perform public.boh_vault_append_audit_event(requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,case when existed then 'item_updated' else 'item_created' end,requested_request_id,
    requested_environment,'item',requested_item_id,jsonb_build_object('item_key',requested_item_key,'item_type',requested_item_type));
  return requested_item_id;
end;
$$;

create or replace function public.boh_vault_recompute_item_readiness(
  requested_tenant_id uuid, requested_item_id uuid, requested_actor_boh_user_id uuid
)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare next_state text;
begin
  select case
    when item.value_state = 'disabled' then 'disabled'
    when exists (
      select 1
      from public.boh_vault_item_fields required_field
      where required_field.tenant_id = requested_tenant_id
        and required_field.vault_item_id = requested_item_id
        and required_field.is_required
        and (
          (required_field.field_kind = 'plaintext' and btrim(coalesce(required_field.plaintext_value, '')) = '')
          or (required_field.field_kind = 'protected' and not exists (
            select 1
            from public.boh_vault_secret_versions active_version
            where active_version.tenant_id = required_field.tenant_id
              and active_version.vault_item_id = required_field.vault_item_id
              and active_version.item_field_id = required_field.id
              and active_version.state = 'active'
          ))
        )
    ) then 'needs_setup'
    else 'configured'
  end
  into next_state
  from public.boh_vault_items item
  where item.tenant_id = requested_tenant_id and item.id = requested_item_id
  for update;

  if next_state is null then
    raise exception 'Vault item not found for readiness calculation' using errcode = '23503';
  end if;

  update public.boh_vault_items
  set value_state = next_state, updated_by = requested_actor_boh_user_id
  where tenant_id = requested_tenant_id and id = requested_item_id;

  return next_state;
end;
$$;

create or replace function public.boh_vault_upsert_item_field(
  requested_field_id uuid, requested_tenant_id uuid, requested_item_id uuid, requested_environment text,
  requested_field_key text, requested_label text, requested_field_kind text, requested_plaintext_value text,
  requested_is_required boolean, requested_sort_order integer, requested_metadata jsonb,
  requested_actor_boh_user_id uuid, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare existed boolean;
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  if not exists(select 1 from public.boh_vault_items where tenant_id=requested_tenant_id and id=requested_item_id and environment=requested_environment) then
    raise exception 'Exact item environment not found' using errcode='23503';
  end if;
  select exists(select 1 from public.boh_vault_item_fields where tenant_id=requested_tenant_id and id=requested_field_id) into existed;
  if existed then
    update public.boh_vault_item_fields set field_key=requested_field_key,label=requested_label,
      field_kind=requested_field_kind,plaintext_value=requested_plaintext_value,is_required=requested_is_required,
      sort_order=requested_sort_order,metadata=coalesce(requested_metadata,'{}'::jsonb),updated_by=requested_actor_boh_user_id
      where tenant_id=requested_tenant_id and id=requested_field_id and vault_item_id=requested_item_id;
    if not found then raise exception 'Exact item field not found' using errcode='23503'; end if;
  else
    insert into public.boh_vault_item_fields(id,tenant_id,vault_item_id,field_key,label,field_kind,plaintext_value,
      is_required,sort_order,metadata,created_by,updated_by) values(requested_field_id,requested_tenant_id,
      requested_item_id,requested_field_key,requested_label,requested_field_kind,requested_plaintext_value,
      requested_is_required,requested_sort_order,coalesce(requested_metadata,'{}'::jsonb),requested_actor_boh_user_id,requested_actor_boh_user_id);
  end if;
  perform public.boh_vault_recompute_item_readiness(
    requested_tenant_id, requested_item_id, requested_actor_boh_user_id
  );
  perform public.boh_vault_append_audit_event(requested_tenant_id,requested_item_id,requested_actor_boh_user_id,
    requested_service_identity,case when existed then 'field_updated' else 'field_created' end,requested_request_id,
    requested_environment,'item_field',requested_field_id,
    jsonb_build_object('field_key',requested_field_key,'field_kind',requested_field_kind,'is_required',requested_is_required));
  return requested_field_id;
end;
$$;

create or replace function public.boh_vault_create_tenant_key(
  requested_key_id uuid, requested_tenant_id uuid, requested_key_version integer,
  requested_wrapping_key_ref text, requested_wrapped_key text, requested_actor_boh_user_id uuid,
  requested_environment text, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  insert into public.boh_vault_tenant_keys(id,tenant_id,key_version,wrapping_key_ref,wrapped_key,state,created_by)
    values(requested_key_id,requested_tenant_id,requested_key_version,requested_wrapping_key_ref,requested_wrapped_key,'pending',requested_actor_boh_user_id);
  perform public.boh_vault_append_audit_event(requested_tenant_id,null,requested_actor_boh_user_id,
    requested_service_identity,'tenant_key_created',requested_request_id,requested_environment,'tenant_key',requested_key_id,
    jsonb_build_object('key_version',requested_key_version,'algorithm','AES-256-GCM'));
  return requested_key_id;
end;
$$;

create or replace function public.boh_vault_transition_tenant_key(
  requested_key_id uuid, requested_tenant_id uuid, requested_new_state text,
  requested_actor_boh_user_id uuid, requested_environment text, requested_request_id text, requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare event_name text;
begin
  perform public.boh_vault_require_service_actor(requested_tenant_id, requested_actor_boh_user_id, requested_environment);
  if requested_new_state = 'active' then
    update public.boh_vault_tenant_keys set state='active',activated_at=transaction_timestamp()
      where tenant_id=requested_tenant_id and id=requested_key_id and state='pending';
    event_name := 'tenant_key_activated';
  elsif requested_new_state in ('retired','revoked') then
    update public.boh_vault_tenant_keys set state=requested_new_state,retired_at=transaction_timestamp()
      where tenant_id=requested_tenant_id and id=requested_key_id and state in ('pending','active');
    event_name := case when requested_new_state='retired' then 'tenant_key_retired' else 'tenant_key_revoked' end;
  else
    raise exception 'Unsupported tenant-key transition' using errcode='22023';
  end if;
  if not found then raise exception 'Exact mutable tenant key not found' using errcode='23503'; end if;
  perform public.boh_vault_append_audit_event(requested_tenant_id,null,requested_actor_boh_user_id,
    requested_service_identity,event_name,requested_request_id,requested_environment,'tenant_key',requested_key_id,
    jsonb_build_object('state',requested_new_state));
  return requested_key_id;
end;
$$;

-- Atomic protected-value commit. The function validates the exact item/field/key,
-- authorized actor, active tenant/app/grant, supersedes the old version, inserts
-- AES-256-GCM payload, updates item readiness, and appends audit in one transaction.
create or replace function public.boh_vault_commit_secret_version(
  requested_tenant_id uuid,
  requested_item_id uuid,
  requested_field_id uuid,
  requested_tenant_key_id uuid,
  requested_actor_boh_user_id uuid,
  requested_ciphertext text,
  requested_nonce text,
  requested_wrapped_data_key text,
  requested_request_id text,
  requested_service_identity text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item_environment text;
  next_version integer;
  committed_id uuid;
  prior_version_id uuid;
  prior_version integer;
  item_is_ready boolean;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if btrim(coalesce(requested_ciphertext, '')) = ''
     or btrim(coalesce(requested_nonce, '')) = ''
     or btrim(coalesce(requested_wrapped_data_key, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = ''
     or btrim(coalesce(requested_service_identity, '')) = '' then
    raise exception 'Encrypted payload, request ID, and service identity are required' using errcode = '22023';
  end if;

  select item.environment into item_environment
  from public.boh_vault_items item
  join public.boh_vault_item_fields field
    on field.tenant_id = item.tenant_id and field.vault_item_id = item.id and field.id = requested_field_id
  join public.boh_vault_tenant_keys tenant_key
    on tenant_key.tenant_id = item.tenant_id and tenant_key.id = requested_tenant_key_id and tenant_key.state = 'active'
  where item.tenant_id = requested_tenant_id and item.id = requested_item_id
    and item.value_state <> 'disabled' and field.field_kind = 'protected'
  for update of item, field;
  if item_environment is null then
    raise exception 'Exact active item/protected-field/tenant-key relationship not found' using errcode = '23503';
  end if;
  if not public.boh_vault_user_has_role(requested_tenant_id, requested_actor_boh_user_id,
      array['vault_admin','vault_editor']::text[], item_environment) then
    raise exception 'Actor is not authorized for this Vault tenant/environment' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(requested_tenant_id::text || requested_field_id::text, 0));
  select coalesce(max(version), 0) + 1 into next_version
  from public.boh_vault_secret_versions
  where tenant_id = requested_tenant_id and item_field_id = requested_field_id;

  update public.boh_vault_secret_versions
  set state = 'superseded', superseded_at = transaction_timestamp()
  where tenant_id = requested_tenant_id and item_field_id = requested_field_id and state = 'active'
  returning id, version into prior_version_id, prior_version;

  insert into public.boh_vault_secret_versions(
    tenant_id, vault_item_id, item_field_id, tenant_key_id, version,
    ciphertext, nonce, wrapped_data_key, algorithm, state, created_by, activated_at
  ) values (
    requested_tenant_id, requested_item_id, requested_field_id, requested_tenant_key_id, next_version,
    requested_ciphertext, requested_nonce, requested_wrapped_data_key, 'AES-256-GCM', 'active',
    requested_actor_boh_user_id, transaction_timestamp()
  ) returning id into committed_id;

  select not exists (
    select 1
    from public.boh_vault_item_fields required_field
    where required_field.tenant_id = requested_tenant_id
      and required_field.vault_item_id = requested_item_id
      and required_field.is_required
      and (
        (required_field.field_kind = 'plaintext' and btrim(coalesce(required_field.plaintext_value, '')) = '')
        or (required_field.field_kind = 'protected' and not exists (
          select 1 from public.boh_vault_secret_versions active_version
          where active_version.tenant_id = required_field.tenant_id
            and active_version.vault_item_id = required_field.vault_item_id
            and active_version.item_field_id = required_field.id
            and active_version.state = 'active'
        ))
      )
  ) into item_is_ready;

  update public.boh_vault_items
  set value_state = case when item_is_ready then 'configured' else 'needs_setup' end,
      last_rotated_at = case when prior_version_id is not null then transaction_timestamp() else last_rotated_at end,
      updated_by = requested_actor_boh_user_id
  where tenant_id = requested_tenant_id and id = requested_item_id;

  insert into public.boh_vault_audit_events(
    tenant_id, vault_item_id, actor_boh_user_id, service_identity, event_type,
    request_id, environment, subject_type, subject_id, metadata
  ) values (
    requested_tenant_id, requested_item_id, requested_actor_boh_user_id, requested_service_identity,
    'secret_version_committed', requested_request_id, item_environment, 'secret_version', committed_id,
    jsonb_build_object('version', next_version, 'prior_version', prior_version,
      'prior_version_id', prior_version_id, 'algorithm', 'AES-256-GCM', 'field_id', requested_field_id)
  );
  if prior_version_id is not null then
    insert into public.boh_vault_audit_events(
      tenant_id, vault_item_id, actor_boh_user_id, service_identity, event_type,
      request_id, environment, subject_type, subject_id, metadata
    ) values
      (requested_tenant_id, requested_item_id, requested_actor_boh_user_id, requested_service_identity,
       'secret_version_superseded', requested_request_id, item_environment, 'secret_version', prior_version_id,
       jsonb_build_object('prior_version', prior_version, 'new_version', next_version,
         'new_version_id', committed_id, 'field_id', requested_field_id)),
      (requested_tenant_id, requested_item_id, requested_actor_boh_user_id, requested_service_identity,
       'rotated', requested_request_id, item_environment, 'item_field', requested_field_id,
       jsonb_build_object('prior_version', prior_version, 'prior_version_id', prior_version_id,
         'new_version', next_version, 'new_version_id', committed_id));
  end if;
  return committed_id;
end;
$$;

revoke all on function public.boh_vault_current_user_id(uuid) from public, anon;
revoke all on function public.boh_vault_user_has_role(uuid, uuid, text[], text) from public, anon, authenticated;
revoke all on function public.boh_vault_has_role(uuid, text[], text) from public, anon;
revoke all on function public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_append_audit_event(uuid,uuid,uuid,text,text,text,text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.boh_vault_require_service_actor(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.boh_vault_mutate_access_grant(uuid,uuid,uuid,text,text,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_upsert_collection(uuid,uuid,text,uuid,text,text,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_set_collection_membership(uuid,uuid,text,uuid,uuid,boolean,uuid,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_upsert_item(uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_recompute_item_readiness(uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.boh_vault_upsert_item_field(uuid,uuid,uuid,text,text,text,text,text,boolean,integer,jsonb,uuid,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_create_tenant_key(uuid,uuid,integer,text,text,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.boh_vault_transition_tenant_key(uuid,uuid,text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.boh_vault_current_user_id(uuid) to authenticated;
grant execute on function public.boh_vault_has_role(uuid, text[], text) to authenticated;
grant execute on function public.boh_vault_commit_secret_version(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) to service_role;
grant execute on function public.boh_vault_append_audit_event(uuid,uuid,uuid,text,text,text,text,text,uuid,jsonb) to service_role;
grant execute on function public.boh_vault_require_service_actor(uuid,uuid,text) to service_role;
grant execute on function public.boh_vault_mutate_access_grant(uuid,uuid,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_upsert_collection(uuid,uuid,text,uuid,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_set_collection_membership(uuid,uuid,text,uuid,uuid,boolean,uuid,text,text) to service_role;
grant execute on function public.boh_vault_upsert_item(uuid,uuid,text,text,text,text,text,text,text,text,uuid,text,text) to service_role;
grant execute on function public.boh_vault_upsert_item_field(uuid,uuid,uuid,text,text,text,text,text,boolean,integer,jsonb,uuid,text,text) to service_role;
grant execute on function public.boh_vault_create_tenant_key(uuid,uuid,integer,text,text,uuid,text,text,text) to service_role;
grant execute on function public.boh_vault_transition_tenant_key(uuid,uuid,text,uuid,text,text,text) to service_role;

create trigger boh_vault_access_grants_updated_at before update on public.boh_vault_access_grants for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_collections_updated_at before update on public.boh_vault_collections for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_items_updated_at before update on public.boh_vault_items for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_item_fields_updated_at before update on public.boh_vault_item_fields for each row execute function public.boh_vault_set_updated_at();
create trigger boh_vault_item_fields_protected_history before update of field_kind on public.boh_vault_item_fields for each row execute function public.boh_vault_prevent_protected_field_downgrade();
create trigger boh_vault_tenant_keys_guard before insert or update or delete on public.boh_vault_tenant_keys for each row execute function public.boh_vault_guard_tenant_key_mutation();
create trigger boh_vault_secret_versions_protected_field before insert on public.boh_vault_secret_versions for each row execute function public.boh_vault_require_protected_secret_field();
create trigger boh_vault_secret_versions_guard before insert or update or delete on public.boh_vault_secret_versions for each row execute function public.boh_vault_guard_secret_version_mutation();
create trigger boh_vault_audit_events_safe_metadata before insert on public.boh_vault_audit_events for each row execute function public.boh_vault_reject_unsafe_metadata();
create trigger boh_vault_audit_events_server_timestamp before insert on public.boh_vault_audit_events for each row execute function public.boh_vault_force_audit_timestamp();
create trigger boh_vault_audit_events_append_only before update or delete on public.boh_vault_audit_events for each row execute function public.boh_vault_reject_mutation();

alter table public.boh_vault_access_grants enable row level security;
alter table public.boh_vault_collections enable row level security;
alter table public.boh_vault_items enable row level security;
alter table public.boh_vault_collection_items enable row level security;
alter table public.boh_vault_item_fields enable row level security;
alter table public.boh_vault_tenant_keys enable row level security;
alter table public.boh_vault_secret_versions enable row level security;
alter table public.boh_vault_audit_events enable row level security;

create policy boh_vault_access_grants_select on public.boh_vault_access_grants for select to authenticated using (
  public.boh_vault_has_role(tenant_id, array['vault_admin']::text[], environment)
  or (boh_user_id = public.boh_vault_current_user_id(tenant_id)
      and public.boh_vault_has_role(tenant_id, array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], environment))
);
create policy boh_vault_collections_select on public.boh_vault_collections for select to authenticated using (
  public.boh_vault_has_role(tenant_id, array['vault_admin','vault_editor','vault_viewer']::text[], environment)
);
create policy boh_vault_items_select on public.boh_vault_items for select to authenticated using (
  public.boh_vault_has_role(tenant_id, array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], environment)
);
create policy boh_vault_collection_items_select on public.boh_vault_collection_items for select to authenticated using (
  public.boh_vault_has_role(tenant_id, array['vault_admin','vault_editor','vault_viewer']::text[], environment)
);
create policy boh_vault_item_fields_select on public.boh_vault_item_fields for select to authenticated using (
  exists (select 1 from public.boh_vault_items item
    where item.tenant_id = boh_vault_item_fields.tenant_id and item.id = boh_vault_item_fields.vault_item_id
      and public.boh_vault_has_role(item.tenant_id, array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], item.environment))
);
create policy boh_vault_audit_events_select on public.boh_vault_audit_events for select to authenticated using (
  public.boh_vault_has_role(tenant_id, array['vault_admin','vault_editor','vault_viewer']::text[], environment)
);
-- No browser policies exist for key/secret tables or for any Vault writes.

create view public.boh_vault_items_safe with (security_barrier = true) as
select item.id, item.tenant_id, item.item_key, item.display_name, item.item_type,
  item.provider_key, item.purpose, item.environment, item.description, item.notes,
  item.value_state, item.validation_state, item.last_validated_at, item.last_rotated_at,
  item.rotation_due_at, item.owner_boh_user_id, item.created_at, item.updated_at
from public.boh_vault_items item
where public.boh_vault_has_role(item.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], item.environment);

create view public.boh_vault_item_fields_safe with (security_barrier = true) as
select field.id, field.tenant_id, field.vault_item_id, field.field_key, field.label,
  field.field_kind,
  case when field.field_kind = 'plaintext' then field.plaintext_value else null end as plaintext_value,
  field.is_required, field.sort_order, field.created_at, field.updated_at
from public.boh_vault_item_fields field
join public.boh_vault_items item on item.tenant_id = field.tenant_id and item.id = field.vault_item_id
where public.boh_vault_has_role(field.tenant_id,
  array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[], item.environment);

create view public.boh_vault_collections_safe with (security_barrier = true) as
select collection.id, collection.tenant_id, collection.environment,
  collection.parent_collection_id, collection.name, collection.description,
  collection.status, collection.created_at, collection.updated_at
from public.boh_vault_collections collection
where public.boh_vault_has_role(collection.tenant_id,
  array['vault_admin','vault_editor','vault_viewer']::text[], collection.environment);

create view public.boh_vault_collection_items_safe with (security_barrier = true) as
select membership.id, membership.tenant_id, membership.environment,
  membership.collection_id, membership.vault_item_id, membership.created_at
from public.boh_vault_collection_items membership
where public.boh_vault_has_role(membership.tenant_id,
  array['vault_admin','vault_editor','vault_viewer']::text[], membership.environment);

create view public.boh_vault_audit_events_safe with (security_barrier = true) as
select event.id, event.tenant_id, event.vault_item_id, event.actor_boh_user_id,
  event.service_identity, event.event_type, event.request_id, event.environment,
  event.subject_type, event.subject_id, event.metadata, event.created_at
from public.boh_vault_audit_events event
where public.boh_vault_has_role(event.tenant_id,
  array['vault_admin','vault_editor','vault_viewer']::text[], event.environment);

revoke all on table public.boh_vault_access_grants from anon, authenticated, service_role;
revoke all on table public.boh_vault_collections from anon, authenticated;
revoke all on table public.boh_vault_items from anon, authenticated;
revoke all on table public.boh_vault_collection_items from anon, authenticated;
revoke all on table public.boh_vault_item_fields from anon, authenticated;
revoke all on table public.boh_vault_tenant_keys from anon, authenticated, service_role;
revoke all on table public.boh_vault_secret_versions from anon, authenticated, service_role;
revoke all on table public.boh_vault_audit_events from anon, authenticated, service_role;
-- service_role can mutate core state only through the audited SECURITY DEFINER RPCs above.
revoke all on table public.boh_vault_collections from service_role;
revoke all on table public.boh_vault_items from service_role;
revoke all on table public.boh_vault_collection_items from service_role;
revoke all on table public.boh_vault_item_fields from service_role;
revoke all on table public.boh_vault_items_safe from anon;
revoke all on table public.boh_vault_item_fields_safe from anon;
revoke all on table public.boh_vault_collections_safe from anon;
revoke all on table public.boh_vault_collection_items_safe from anon;
revoke all on table public.boh_vault_audit_events_safe from anon;
grant select on public.boh_vault_items_safe to authenticated;
grant select on public.boh_vault_item_fields_safe to authenticated;
grant select on public.boh_vault_collections_safe to authenticated;
grant select on public.boh_vault_collection_items_safe to authenticated;
grant select on public.boh_vault_audit_events_safe to authenticated;

comment on table public.boh_vault_item_fields is 'Plaintext is allowed only for explicitly plaintext, non-credential fields; protected values exist only in backend-only versions.';
comment on table public.boh_vault_secret_versions is 'Immutable AES-256-GCM payload versions, committed atomically with audit by the service boundary.';
comment on table public.boh_vault_audit_events is 'Append-only, tenant-consistent Vault audit history with recursively checked metadata.';
comment on view public.boh_vault_items_safe is 'Browser-safe item metadata including ordinary plaintext notes/descriptions; never cryptographic material.';

commit;
