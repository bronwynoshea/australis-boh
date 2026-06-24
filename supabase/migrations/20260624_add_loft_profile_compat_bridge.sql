-- Transitional compatibility bridge for imported Loft app/functions.
-- BOH canonical identity remains public.boh_user. Loft source expects public.profile.

begin;

create table if not exists public.profile (
  id uuid primary key,
  user_id uuid unique,
  email text,
  display_name text,
  full_name text,
  first_name text,
  last_name text,
  avatar_url text,
  default_bg_id text,
  subscription_level text,
  access_override text,
  user_type_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profile (
  id,
  user_id,
  email,
  display_name,
  full_name,
  first_name,
  last_name,
  avatar_url,
  user_type_id,
  created_at,
  updated_at
)
select
  u.id,
  u.auth_user_id,
  u.email,
  coalesce(u.display_name, u.full_name, split_part(coalesce(u.email, ''), '@', 1)),
  u.full_name,
  u.first_name,
  u.last_name,
  u.avatar_url,
  case when lower(coalesce(u.primary_role_hint, '')) in ('admin', 'owner', 'super_admin', 'superadmin') then 5 else null end,
  u.created_at,
  u.updated_at
from public.boh_user u
on conflict (id) do update
set user_id = excluded.user_id,
    email = excluded.email,
    display_name = excluded.display_name,
    full_name = excluded.full_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    avatar_url = excluded.avatar_url,
    user_type_id = coalesce(public.profile.user_type_id, excluded.user_type_id),
    updated_at = now();

create or replace function public.sync_boh_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (
    id,
    user_id,
    email,
    display_name,
    full_name,
    first_name,
    last_name,
    avatar_url,
    user_type_id,
    created_at,
    updated_at
  ) values (
    new.id,
    new.auth_user_id,
    new.email,
    coalesce(new.display_name, new.full_name, split_part(coalesce(new.email, ''), '@', 1)),
    new.full_name,
    new.first_name,
    new.last_name,
    new.avatar_url,
    case when lower(coalesce(new.primary_role_hint, '')) in ('admin', 'owner', 'super_admin', 'superadmin') then 5 else null end,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, now())
  )
  on conflict (id) do update
  set user_id = excluded.user_id,
      email = excluded.email,
      display_name = excluded.display_name,
      full_name = excluded.full_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      avatar_url = excluded.avatar_url,
      user_type_id = coalesce(public.profile.user_type_id, excluded.user_type_id),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_boh_user_to_profile on public.boh_user;
create trigger sync_boh_user_to_profile
  after insert or update on public.boh_user
  for each row
  execute function public.sync_boh_user_to_profile();

commit;
