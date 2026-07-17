-- Cookbook-owned canonical assets, editable working files, conversation, and immutable versions.
-- Static browser output only: this schema provides no arbitrary execution or protected-value access.

begin;

create table public.cookbook_asset (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  asset_type text not null default 'web_page' check (asset_type in ('web_page')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'archived')),
  review_state text not null default 'not_requested' check (review_state in ('not_requested', 'ready', 'changes_requested', 'approved')),
  current_version_id uuid,
  created_by uuid not null references public.boh_user(id),
  updated_by uuid not null references public.boh_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.cookbook_asset_file (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  asset_id uuid not null,
  path text not null check (path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$' and path !~ '(^|/)\.\.(/|$)'),
  content text not null default '',
  mime_type text not null default 'text/plain',
  updated_by uuid not null references public.boh_user(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, path),
  unique (id, tenant_id),
  foreign key (asset_id, tenant_id) references public.cookbook_asset(id, tenant_id) on delete cascade
);

create table public.cookbook_asset_message (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  asset_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(btrim(content)) between 1 and 12000),
  created_by uuid not null references public.boh_user(id),
  created_at timestamptz not null default now(),
  foreign key (asset_id, tenant_id) references public.cookbook_asset(id, tenant_id) on delete cascade
);

create table public.cookbook_asset_version (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  asset_id uuid not null,
  version_number integer not null check (version_number > 0),
  file_snapshot jsonb not null check (jsonb_typeof(file_snapshot) = 'array'),
  change_summary text,
  provenance jsonb not null default '{"generator":"bounded_cookbook_assistant"}'::jsonb,
  created_by uuid not null references public.boh_user(id),
  created_at timestamptz not null default now(),
  unique (asset_id, version_number),
  unique (id, asset_id, tenant_id),
  foreign key (asset_id, tenant_id) references public.cookbook_asset(id, tenant_id) on delete cascade
);

alter table public.cookbook_asset
  add constraint cookbook_asset_current_version_fk
  foreign key (current_version_id, id, tenant_id)
  references public.cookbook_asset_version(id, asset_id, tenant_id)
  deferrable initially deferred;

create index cookbook_asset_tenant_updated_idx on public.cookbook_asset(tenant_id, updated_at desc);
create index cookbook_asset_file_asset_idx on public.cookbook_asset_file(asset_id, path);
create index cookbook_asset_message_asset_idx on public.cookbook_asset_message(asset_id, created_at);
create index cookbook_asset_version_asset_idx on public.cookbook_asset_version(asset_id, version_number desc);

create or replace function public.cookbook_asset_studio_has_access(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.boh_user u
    join public.boh_tenant_member m
      on m.user_id = u.id
     and m.tenant_id = target_tenant_id
     and m.membership_status = 'active'
    join public.boh_tenant t
      on t.id = m.tenant_id
     and t.status = 'active'
    join public.boh_app a
      on a.slug = 'cookbook'
     and a.is_active = true
    join public.boh_tenant_app ta
      on ta.tenant_id = m.tenant_id
     and ta.app_id = a.id
     and ta.status in ('enabled', 'trial')
    where u.id = private.current_boh_user_id()
      and u.status = 'active'
  )
$$;

create or replace function public.cookbook_asset_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger cookbook_asset_touch before update on public.cookbook_asset
for each row execute function public.cookbook_asset_touch_updated_at();
create trigger cookbook_asset_file_touch before update on public.cookbook_asset_file
for each row execute function public.cookbook_asset_touch_updated_at();

create or replace function public.cookbook_asset_version_is_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Cookbook asset versions are immutable';
end
$$;

create trigger cookbook_asset_version_immutable
before update or delete on public.cookbook_asset_version
for each row execute function public.cookbook_asset_version_is_immutable();

alter table public.cookbook_asset enable row level security;
alter table public.cookbook_asset_file enable row level security;
alter table public.cookbook_asset_message enable row level security;
alter table public.cookbook_asset_version enable row level security;

create policy cookbook_asset_select on public.cookbook_asset for select to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_insert on public.cookbook_asset for insert to authenticated
  with check (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_update on public.cookbook_asset for update to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id))
  with check (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_delete on public.cookbook_asset for delete to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));

create policy cookbook_asset_file_select on public.cookbook_asset_file for select to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_file_insert on public.cookbook_asset_file for insert to authenticated
  with check (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_file_update on public.cookbook_asset_file for update to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id))
  with check (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_file_delete on public.cookbook_asset_file for delete to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));

create policy cookbook_asset_message_select on public.cookbook_asset_message for select to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_message_insert on public.cookbook_asset_message for insert to authenticated
  with check (public.cookbook_asset_studio_has_access(tenant_id));

create policy cookbook_asset_version_select on public.cookbook_asset_version for select to authenticated
  using (public.cookbook_asset_studio_has_access(tenant_id));
create policy cookbook_asset_version_insert on public.cookbook_asset_version for insert to authenticated
  with check (public.cookbook_asset_studio_has_access(tenant_id));

revoke all privileges on
  public.cookbook_asset,
  public.cookbook_asset_file,
  public.cookbook_asset_message,
  public.cookbook_asset_version
from anon, authenticated;

grant select, insert, update, delete on public.cookbook_asset to authenticated;
grant select, insert, update, delete on public.cookbook_asset_file to authenticated;
grant select, insert on public.cookbook_asset_message to authenticated;
grant select, insert on public.cookbook_asset_version to authenticated;
revoke all on function public.cookbook_asset_studio_has_access(uuid) from public;
revoke all on function public.cookbook_asset_studio_has_access(uuid) from anon;
grant execute on function public.cookbook_asset_studio_has_access(uuid) to authenticated;
revoke all on function public.cookbook_asset_touch_updated_at() from public, anon, authenticated;
revoke all on function public.cookbook_asset_version_is_immutable() from public, anon, authenticated;

commit;
