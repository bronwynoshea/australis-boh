-- CELLAR staff visibility rules through BOH users.
create table if not exists public.cellar_staff_visibility_permissions (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  boh_user_id text not null,
  permission_level text not null default 'viewer' check (permission_level in ('viewer', 'responder', 'owner', 'hidden')),
  granted_by_boh_user_id text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_access_id, boh_user_id)
);

comment on table public.cellar_staff_visibility_permissions is
  'CELLAR staff visibility/assignment rules for selected investor records. BOH user columns store public.boh_user.id values.';

create index if not exists cellar_staff_visibility_boh_user_id_idx
  on public.cellar_staff_visibility_permissions (boh_user_id, permission_level);

drop trigger if exists cellar_staff_visibility_touch_updated_at on public.cellar_staff_visibility_permissions;
create trigger cellar_staff_visibility_touch_updated_at
  before update on public.cellar_staff_visibility_permissions
  for each row execute function public.cellar_touch_updated_at();

create or replace function public.cellar_staff_can_access_investor(p_investor_access_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cellar_boh_user_id text := public.cellar_current_boh_user_id();
begin
  if cellar_boh_user_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.cellar_staff_visibility_permissions as csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level = 'hidden'
      and (csvp.expires_at is null or csvp.expires_at > now())
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.cellar_investor_access as cia
    where cia.id = p_investor_access_id and cia.assigned_boh_user_id = cellar_boh_user_id
  ) then
    return true;
  end if;

  return exists (
    select 1 from public.cellar_staff_visibility_permissions as csvp
    where csvp.investor_access_id = p_investor_access_id
      and csvp.boh_user_id = cellar_boh_user_id
      and csvp.permission_level in ('viewer', 'responder', 'owner')
      and (csvp.expires_at is null or csvp.expires_at > now())
  );
end;
$$;
