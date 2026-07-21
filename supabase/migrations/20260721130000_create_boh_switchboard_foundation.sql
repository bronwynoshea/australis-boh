-- Switchboard owns canonical BOH projects and their external service resources.
-- Protected provider values remain in BOH Vault and are referenced only by item ID.
begin;

insert into public.boh_app (
  id, name, slug, description, route, external_url, primary_color,
  type, is_active, app_context, created_at
)
values (
  gen_random_uuid(),
  'Switchboard',
  'switchboard',
  'Projects, connected services, builds, deployments, maintenance, and operational history.',
  '/switchboard',
  null,
  null,
  'internal_tool',
  true,
  'boh',
  now()
)
on conflict (slug) do update
set name=excluded.name,
    description=excluded.description,
    route=excluded.route,
    external_url=null,
    type='internal_tool',
    is_active=true,
    app_context='boh';

create table public.boh_switchboard_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  project_key text not null check (project_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> '' and char_length(name) <= 240),
  description text check (description is null or char_length(description) <= 10000),
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_by uuid not null references public.boh_user(id) on delete restrict,
  updated_by uuid not null references public.boh_user(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,project_key),
  unique (tenant_id,id)
);

create table public.boh_switchboard_project_environments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  project_id uuid not null,
  environment text not null check (environment in ('development','production')),
  status text not null default 'active' check (status in ('active','paused','archived')),
  primary_url text check (primary_url is null or (char_length(primary_url) <= 2048 and primary_url ~ '^https://[^[:space:]]+$')),
  created_by uuid not null references public.boh_user(id) on delete restrict,
  updated_by uuid not null references public.boh_user(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,project_id,environment),
  unique (tenant_id,id),
  foreign key (tenant_id,project_id)
    references public.boh_switchboard_projects(tenant_id,id) on delete cascade
);

create table public.boh_switchboard_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  connection_key text not null check (connection_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  provider text not null check (provider in ('github','cloudflare','supabase','vercel','other')),
  environment_scope text not null check (environment_scope in ('shared','development','production')),
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 240),
  external_account_id text check (external_account_id is null or char_length(external_account_id) <= 500),
  external_account_name text check (external_account_name is null or char_length(external_account_name) <= 500),
  credential_vault_item_id uuid,
  status text not null default 'needs_setup' check (status in ('needs_setup','connected','attention','disabled')),
  last_checked_at timestamptz,
  last_error_summary text check (last_error_summary is null or char_length(last_error_summary) <= 2000),
  created_by uuid not null references public.boh_user(id) on delete restrict,
  updated_by uuid not null references public.boh_user(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,connection_key,environment_scope),
  unique (tenant_id,id),
  foreign key (tenant_id,credential_vault_item_id)
    references public.boh_vault_items(tenant_id,id) on delete restrict
);

create table public.boh_switchboard_resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  project_id uuid not null,
  connection_id uuid not null,
  environment_scope text not null check (environment_scope in ('shared','development','production')),
  resource_kind text not null check (resource_kind in ('repository','workflow','pages_project','supabase_project','domain','worker','other')),
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 240),
  external_resource_id text not null check (btrim(external_resource_id) <> '' and char_length(external_resource_id) <= 500),
  service_url text check (service_url is null or (char_length(service_url) <= 2048 and service_url ~ '^https://[^[:space:]]+$')),
  status text not null default 'active' check (status in ('active','attention','disabled','archived')),
  created_by uuid not null references public.boh_user(id) on delete restrict,
  updated_by uuid not null references public.boh_user(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,connection_id,resource_kind,external_resource_id,environment_scope),
  unique (tenant_id,id),
  foreign key (tenant_id,project_id)
    references public.boh_switchboard_projects(tenant_id,id) on delete cascade,
  foreign key (tenant_id,connection_id)
    references public.boh_switchboard_connections(tenant_id,id) on delete restrict
);

create table public.boh_switchboard_builds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  project_environment_id uuid not null,
  source_resource_id uuid not null,
  provider text not null default 'github' check (provider in ('github','other')),
  external_build_id text not null check (btrim(external_build_id) <> '' and char_length(external_build_id) <= 500),
  commit_sha text check (commit_sha is null or commit_sha ~ '^[0-9a-fA-F]{7,64}$'),
  branch_name text check (branch_name is null or char_length(branch_name) <= 500),
  tag_name text check (tag_name is null or char_length(tag_name) <= 500),
  version_label text check (version_label is null or char_length(version_label) <= 240),
  status text not null check (status in ('queued','running','succeeded','failed','cancelled')),
  build_url text check (build_url is null or (char_length(build_url) <= 2048 and build_url ~ '^https://[^[:space:]]+$')),
  forge_release_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  recorded_at timestamptz not null default now(),
  unique (tenant_id,provider,external_build_id),
  unique (tenant_id,id),
  foreign key (tenant_id,project_environment_id)
    references public.boh_switchboard_project_environments(tenant_id,id) on delete cascade,
  foreign key (tenant_id,source_resource_id)
    references public.boh_switchboard_resources(tenant_id,id) on delete restrict
);

create table public.boh_switchboard_deployments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  project_environment_id uuid not null,
  target_resource_id uuid not null,
  build_id uuid,
  provider text not null check (provider in ('cloudflare','supabase','vercel','other')),
  external_deployment_id text not null check (btrim(external_deployment_id) <> '' and char_length(external_deployment_id) <= 500),
  status text not null check (status in ('queued','running','succeeded','failed','cancelled','deleted')),
  deployment_url text check (deployment_url is null or (char_length(deployment_url) <= 2048 and deployment_url ~ '^https://[^[:space:]]+$')),
  is_current boolean not null default false,
  deployed_at timestamptz,
  recorded_at timestamptz not null default now(),
  unique (tenant_id,provider,external_deployment_id),
  unique (tenant_id,id),
  foreign key (tenant_id,project_environment_id)
    references public.boh_switchboard_project_environments(tenant_id,id) on delete cascade,
  foreign key (tenant_id,target_resource_id)
    references public.boh_switchboard_resources(tenant_id,id) on delete restrict,
  foreign key (tenant_id,build_id)
    references public.boh_switchboard_builds(tenant_id,id) on delete restrict
);

create table public.boh_switchboard_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  actor_boh_user_id uuid references public.boh_user(id) on delete set null,
  event_type text not null check (btrim(event_type) <> '' and char_length(event_type) <= 120),
  project_id uuid,
  resource_id uuid,
  request_id text not null check (btrim(request_id) <> '' and char_length(request_id) <= 240),
  summary text not null check (btrim(summary) <> '' and char_length(summary) <= 2000),
  created_at timestamptz not null default now(),
  unique (tenant_id,event_type,request_id),
  foreign key (tenant_id,project_id)
    references public.boh_switchboard_projects(tenant_id,id) on delete restrict,
  foreign key (tenant_id,resource_id)
    references public.boh_switchboard_resources(tenant_id,id) on delete restrict
);

create index boh_switchboard_projects_tenant_status_idx
  on public.boh_switchboard_projects(tenant_id,status,name);
create index boh_switchboard_project_environments_project_idx
  on public.boh_switchboard_project_environments(tenant_id,project_id,environment);
create index boh_switchboard_resources_project_idx
  on public.boh_switchboard_resources(tenant_id,project_id,environment_scope,resource_kind);
create index boh_switchboard_builds_environment_idx
  on public.boh_switchboard_builds(tenant_id,project_environment_id,recorded_at desc);
create index boh_switchboard_deployments_environment_idx
  on public.boh_switchboard_deployments(tenant_id,project_environment_id,recorded_at desc);
create unique index boh_switchboard_deployments_one_current_idx
  on public.boh_switchboard_deployments(tenant_id,project_environment_id,target_resource_id)
  where is_current;
create index boh_switchboard_audit_tenant_idx
  on public.boh_switchboard_audit_events(tenant_id,created_at desc);

create or replace function private.boh_switchboard_validate_build_relationships()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  environment_project_id uuid;
  environment_name text;
  resource_project_id uuid;
  resource_environment text;
  resource_kind_name text;
  resource_provider text;
begin
  select project_id,environment into environment_project_id,environment_name
  from public.boh_switchboard_project_environments
  where tenant_id=new.tenant_id and id=new.project_environment_id and status='active';
  if environment_project_id is null then
    raise exception 'Active build project environment not found' using errcode='23503';
  end if;

  select resource.project_id,resource.environment_scope,resource.resource_kind,connection.provider
    into resource_project_id,resource_environment,resource_kind_name,resource_provider
  from public.boh_switchboard_resources resource
  join public.boh_switchboard_connections connection
    on connection.tenant_id=resource.tenant_id and connection.id=resource.connection_id
  where resource.tenant_id=new.tenant_id and resource.id=new.source_resource_id
    and resource.status='active' and connection.status<>'disabled';
  if resource_project_id is null then
    raise exception 'Active build source resource not found' using errcode='23503';
  end if;
  if resource_project_id<>environment_project_id then
    raise exception 'Build source resource must belong to the project environment project' using errcode='23514';
  end if;
  if resource_environment not in ('shared',environment_name) then
    raise exception 'Build source resource environment does not match the project environment' using errcode='23514';
  end if;
  if resource_kind_name='domain' then
    raise exception 'Domain resources cannot be build sources' using errcode='23514';
  end if;
  if new.provider<>'other' and resource_provider<>new.provider then
    raise exception 'Build provider must match the source resource provider' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger boh_switchboard_build_relationships
before insert or update on public.boh_switchboard_builds
for each row execute function private.boh_switchboard_validate_build_relationships();

create or replace function private.boh_switchboard_validate_deployment_relationships()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  environment_project_id uuid;
  environment_name text;
  resource_project_id uuid;
  resource_environment text;
  resource_kind_name text;
  resource_provider text;
  build_environment_id uuid;
begin
  select project_id,environment into environment_project_id,environment_name
  from public.boh_switchboard_project_environments
  where tenant_id=new.tenant_id and id=new.project_environment_id and status='active';
  if environment_project_id is null then
    raise exception 'Active deployment project environment not found' using errcode='23503';
  end if;

  select resource.project_id,resource.environment_scope,resource.resource_kind,connection.provider
    into resource_project_id,resource_environment,resource_kind_name,resource_provider
  from public.boh_switchboard_resources resource
  join public.boh_switchboard_connections connection
    on connection.tenant_id=resource.tenant_id and connection.id=resource.connection_id
  where resource.tenant_id=new.tenant_id and resource.id=new.target_resource_id
    and resource.status='active' and connection.status<>'disabled';
  if resource_project_id is null then
    raise exception 'Active deployment target resource not found' using errcode='23503';
  end if;
  if resource_project_id<>environment_project_id then
    raise exception 'Deployment target resource must belong to the project environment project' using errcode='23514';
  end if;
  if resource_environment not in ('shared',environment_name) then
    raise exception 'Deployment target resource environment does not match the project environment' using errcode='23514';
  end if;
  if resource_kind_name in ('repository','workflow') then
    raise exception 'Repository and workflow resources cannot be deployment targets' using errcode='23514';
  end if;
  if new.provider<>'other' and resource_provider<>new.provider then
    raise exception 'Deployment provider must match the target resource provider' using errcode='23514';
  end if;
  if new.build_id is not null then
    select project_environment_id into build_environment_id
    from public.boh_switchboard_builds
    where tenant_id=new.tenant_id and id=new.build_id;
    if build_environment_id is null or build_environment_id<>new.project_environment_id then
      raise exception 'Deployment build must belong to the same project environment' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger boh_switchboard_deployment_relationships
before insert or update on public.boh_switchboard_deployments
for each row execute function private.boh_switchboard_validate_deployment_relationships();

create or replace function public.boh_switchboard_has_access(
  requested_tenant_id uuid,
  allowed_permission_levels text[] default array['view','edit','admin']::text[]
)
returns boolean
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select exists (
    select 1
    from public.boh_user user_row
    join public.boh_tenant_member member
      on member.user_id=user_row.id
     and member.tenant_id=requested_tenant_id
     and member.membership_status='active'
    join public.boh_tenant tenant
      on tenant.id=member.tenant_id and tenant.status='active'
    join public.boh_app app
      on app.slug='switchboard' and app.app_context='boh' and app.is_active
    join public.boh_tenant_app tenant_app
      on tenant_app.tenant_id=member.tenant_id
     and tenant_app.app_id=app.id
     and tenant_app.status in ('enabled','trial')
    where user_row.auth_user_id=auth.uid()
      and user_row.status='active'
      and user_row.app_context='boh'
      and (
        exists (
          select 1
          from public.boh_user_role user_role
          join public.boh_role role_row on role_row.id=user_role.role_id
          where user_role.user_id=user_row.id
            and user_role.tenant_id=requested_tenant_id
            and user_role.app_context='boh'
            and role_row.code='super_admin'
        )
        or exists (
          select 1
          from public.boh_user_app user_app
          where user_app.user_id=user_row.id
            and user_app.tenant_id=requested_tenant_id
            and user_app.app_id=app.id
            and user_app.app_context='boh'
            and user_app.permission_level=any(allowed_permission_levels)
        )
      )
  )
$$;

create or replace function public.boh_switchboard_permission_level(requested_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select case
    when public.boh_switchboard_has_access(requested_tenant_id,array['admin']::text[]) then 'admin'
    when public.boh_switchboard_has_access(requested_tenant_id,array['edit']::text[]) then 'edit'
    when public.boh_switchboard_has_access(requested_tenant_id,array['view']::text[]) then 'view'
    else null
  end
$$;

create or replace function private.boh_switchboard_current_actor(requested_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path=public,auth,pg_temp
as $$
  select user_row.id
  from public.boh_user user_row
  join public.boh_tenant_member member
    on member.user_id=user_row.id
   and member.tenant_id=requested_tenant_id
   and member.membership_status='active'
  where user_row.auth_user_id=auth.uid()
    and user_row.status='active'
    and user_row.app_context='boh'
  limit 1
$$;

create or replace function public.boh_switchboard_create_project(
  requested_tenant_id uuid,
  requested_project_key text,
  requested_name text,
  requested_description text,
  requested_request_id text
)
returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  actor_id uuid;
  selected_project_id uuid;
  normalized_key text:=lower(btrim(coalesce(requested_project_key,'')));
begin
  if not public.boh_switchboard_has_access(requested_tenant_id,array['edit','admin']::text[]) then
    raise exception 'Switchboard edit access is required' using errcode='42501';
  end if;
  actor_id:=private.boh_switchboard_current_actor(requested_tenant_id);
  if actor_id is null then raise exception 'Active BOH actor is required' using errcode='42501'; end if;
  if normalized_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Project key must use lowercase letters, numbers, and hyphens' using errcode='22023';
  end if;

  insert into public.boh_switchboard_projects(
    tenant_id,project_key,name,description,created_by,updated_by
  ) values (
    requested_tenant_id,normalized_key,btrim(requested_name),
    nullif(btrim(coalesce(requested_description,'')),''),actor_id,actor_id
  )
  returning id into selected_project_id;

  insert into public.boh_switchboard_project_environments(
    tenant_id,project_id,environment,created_by,updated_by
  ) values
    (requested_tenant_id,selected_project_id,'development',actor_id,actor_id),
    (requested_tenant_id,selected_project_id,'production',actor_id,actor_id);

  insert into public.boh_switchboard_audit_events(
    tenant_id,actor_boh_user_id,event_type,project_id,request_id,summary
  ) values (
    requested_tenant_id,actor_id,'project_created',selected_project_id,
    requested_request_id,'Created Switchboard project '||btrim(requested_name)
  );

  return selected_project_id;
end;
$$;

create or replace function public.boh_switchboard_link_resource(
  requested_tenant_id uuid,
  requested_project_id uuid,
  requested_connection_key text,
  requested_provider text,
  requested_connection_name text,
  requested_external_account_id text,
  requested_external_account_name text,
  requested_credential_vault_item_id uuid,
  requested_environment_scope text,
  requested_resource_kind text,
  requested_resource_name text,
  requested_external_resource_id text,
  requested_service_url text,
  requested_request_id text
)
returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  actor_id uuid;
  selected_connection_id uuid;
  selected_resource_id uuid;
  normalized_connection_key text:=lower(btrim(coalesce(requested_connection_key,'')));
  selected_item_type text;
  selected_item_environment text;
  existing_provider text;
begin
  if not public.boh_switchboard_has_access(requested_tenant_id,array['edit','admin']::text[]) then
    raise exception 'Switchboard edit access is required' using errcode='42501';
  end if;
  actor_id:=private.boh_switchboard_current_actor(requested_tenant_id);
  if actor_id is null then raise exception 'Active BOH actor is required' using errcode='42501'; end if;
  if not exists (
    select 1 from public.boh_switchboard_projects
    where tenant_id=requested_tenant_id and id=requested_project_id and status='active'
  ) then raise exception 'Active Switchboard project not found' using errcode='P0002'; end if;
  if normalized_connection_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Connection key must use lowercase letters, numbers, and hyphens' using errcode='22023';
  end if;
  if requested_service_url is not null and btrim(requested_service_url)<>''
     and btrim(requested_service_url) !~ '^https://[^[:space:]]+$' then
    raise exception 'Service URL must use HTTPS' using errcode='22023';
  end if;
  if requested_credential_vault_item_id is not null then
    select item_type,environment into selected_item_type,selected_item_environment
    from public.boh_vault_items
    where tenant_id=requested_tenant_id
      and id=requested_credential_vault_item_id
      and value_state <> 'disabled';
    if selected_item_type is null then raise exception 'Vault item not found' using errcode='P0002'; end if;
    if selected_item_type='login' then
      raise exception 'Password items cannot authorize Switchboard services' using errcode='22023';
    end if;
    if requested_environment_scope='shared' then
      raise exception 'Shared resources cannot use an exact-environment Vault credential' using errcode='22023';
    end if;
    if selected_item_environment<>requested_environment_scope then
      raise exception 'Vault credential environment must match the service resource environment' using errcode='22023';
    end if;
    if not public.boh_vault_user_can_access_item(
      requested_tenant_id,
      requested_credential_vault_item_id,
      actor_id,
      selected_item_environment,
      'read'
    ) then
      raise exception 'Vault credential access is required' using errcode='42501';
    end if;
  end if;

  select provider into existing_provider
  from public.boh_switchboard_connections
  where tenant_id=requested_tenant_id
    and connection_key=normalized_connection_key
    and environment_scope=requested_environment_scope;
  if existing_provider is not null and existing_provider<>requested_provider then
    raise exception 'Connection key is already assigned to another provider' using errcode='23505';
  end if;

  insert into public.boh_switchboard_connections(
    tenant_id,connection_key,provider,environment_scope,display_name,external_account_id,
    external_account_name,credential_vault_item_id,status,created_by,updated_by
  ) values (
    requested_tenant_id,normalized_connection_key,requested_provider,requested_environment_scope,
    btrim(requested_connection_name),nullif(btrim(coalesce(requested_external_account_id,'')),''),
    nullif(btrim(coalesce(requested_external_account_name,'')),''),
    requested_credential_vault_item_id,
    case when requested_credential_vault_item_id is null then 'needs_setup' else 'connected' end,
    actor_id,actor_id
  )
  on conflict (tenant_id,connection_key,environment_scope) do update set
    display_name=excluded.display_name,
    external_account_id=excluded.external_account_id,
    external_account_name=excluded.external_account_name,
    credential_vault_item_id=excluded.credential_vault_item_id,
    status=excluded.status,
    updated_by=actor_id,
    updated_at=now()
  returning id into selected_connection_id;

  insert into public.boh_switchboard_resources(
    tenant_id,project_id,connection_id,environment_scope,resource_kind,
    display_name,external_resource_id,service_url,created_by,updated_by
  ) values (
    requested_tenant_id,requested_project_id,selected_connection_id,
    requested_environment_scope,requested_resource_kind,btrim(requested_resource_name),
    btrim(requested_external_resource_id),nullif(btrim(coalesce(requested_service_url,'')),''),
    actor_id,actor_id
  )
  on conflict (tenant_id,connection_id,resource_kind,external_resource_id,environment_scope)
  do update set
    project_id=excluded.project_id,
    display_name=excluded.display_name,
    service_url=excluded.service_url,
    status='active',
    updated_by=actor_id,
    updated_at=now()
  returning id into selected_resource_id;

  insert into public.boh_switchboard_audit_events(
    tenant_id,actor_boh_user_id,event_type,project_id,resource_id,request_id,summary
  ) values (
    requested_tenant_id,actor_id,'resource_linked',requested_project_id,
    selected_resource_id,requested_request_id,
    'Linked '||requested_provider||' '||requested_resource_kind||' '||btrim(requested_resource_name)
  );

  return selected_resource_id;
end;
$$;

create or replace function private.boh_switchboard_reject_audit_mutation()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  raise exception 'Switchboard audit events are append-only' using errcode='42501';
end;
$$;
create trigger boh_switchboard_audit_append_only
before update or delete on public.boh_switchboard_audit_events
for each row execute function private.boh_switchboard_reject_audit_mutation();

alter table public.boh_switchboard_projects enable row level security;
alter table public.boh_switchboard_project_environments enable row level security;
alter table public.boh_switchboard_connections enable row level security;
alter table public.boh_switchboard_resources enable row level security;
alter table public.boh_switchboard_builds enable row level security;
alter table public.boh_switchboard_deployments enable row level security;
alter table public.boh_switchboard_audit_events enable row level security;

create policy boh_switchboard_projects_read on public.boh_switchboard_projects
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_project_environments_read on public.boh_switchboard_project_environments
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_connections_read on public.boh_switchboard_connections
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_resources_read on public.boh_switchboard_resources
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_builds_read on public.boh_switchboard_builds
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_deployments_read on public.boh_switchboard_deployments
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));
create policy boh_switchboard_audit_read on public.boh_switchboard_audit_events
for select to authenticated using (public.boh_switchboard_has_access(tenant_id));

revoke all on table public.boh_switchboard_projects from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_project_environments from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_connections from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_resources from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_builds from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_deployments from anon,authenticated,service_role;
revoke all on table public.boh_switchboard_audit_events from anon,authenticated,service_role;
grant select on public.boh_switchboard_projects to authenticated;
grant select on public.boh_switchboard_project_environments to authenticated;
grant select on public.boh_switchboard_connections to authenticated;
grant select on public.boh_switchboard_resources to authenticated;
grant select on public.boh_switchboard_builds to authenticated;
grant select on public.boh_switchboard_deployments to authenticated;
grant select on public.boh_switchboard_audit_events to authenticated;

revoke all on function public.boh_switchboard_has_access(uuid,text[]) from public,anon;
revoke all on function public.boh_switchboard_permission_level(uuid) from public,anon;
revoke all on function private.boh_switchboard_current_actor(uuid) from public,anon,authenticated;
revoke all on function private.boh_switchboard_validate_build_relationships() from public,anon,authenticated,service_role;
revoke all on function private.boh_switchboard_validate_deployment_relationships() from public,anon,authenticated,service_role;
revoke all on function public.boh_switchboard_create_project(uuid,text,text,text,text) from public,anon;
revoke all on function public.boh_switchboard_link_resource(uuid,uuid,text,text,text,text,text,uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.boh_switchboard_has_access(uuid,text[]) to authenticated;
grant execute on function public.boh_switchboard_permission_level(uuid) to authenticated;

grant execute on function public.boh_switchboard_create_project(uuid,text,text,text,text) to authenticated;
grant execute on function public.boh_switchboard_link_resource(uuid,uuid,text,text,text,text,text,uuid,text,text,text,text,text,text) to authenticated;

comment on table public.boh_switchboard_projects is 'Canonical tenant-owned products managed by Switchboard.';
comment on table public.boh_switchboard_connections is 'Provider account metadata with optional BOH Vault item reference; never provider credentials.';
comment on table public.boh_switchboard_resources is 'GitHub, Cloudflare, Supabase, domain, workflow, and future provider resources linked to canonical projects.';
comment on table public.boh_switchboard_builds is 'Technical source build history; GitHub remains the source of truth for version control.';
comment on column public.boh_switchboard_builds.forge_release_id is 'Optional Forge release reference linking approved release scope to a technical build.';

commit;
