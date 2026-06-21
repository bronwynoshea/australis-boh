begin;

create table if not exists public.cellar_team_members (
  id uuid primary key default gen_random_uuid(),
  boh_user_id text not null unique,
  email text not null,
  role text not null default 'editor'
    check (role in ('viewer', 'messaging', 'editor', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cellar_team_members_email_lower_idx
  on public.cellar_team_members (lower(email));

alter table public.cellar_team_members enable row level security;

create or replace function public.cellar_current_boh_user_id()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cellar_boh_user_id text;
begin
  if auth.uid() is null or to_regclass('public.boh_user') is null then
    return null;
  end if;

  execute 'select id::text from public.boh_user where auth_user_id = $1 limit 1'
    into cellar_boh_user_id
    using auth.uid();

  return cellar_boh_user_id;
end;
$$;

drop policy if exists "cellar_team_members_staff_read" on public.cellar_team_members;

create policy "cellar_team_members_staff_read"
  on public.cellar_team_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = (select auth.uid())
        and bu.app_context = 'boh'
    )
  );

insert into public.cellar_team_members (boh_user_id, email, role, status)
select
  bu.id::text,
  lower(bu.email),
  case
    when bua.permission_level = 'admin' then 'admin'
    when bua.permission_level in ('edit', 'editor') then 'editor'
    else 'viewer'
  end,
  'active'
from public.boh_user bu
join public.boh_user_app bua on bua.user_id = bu.id
join public.boh_app app on app.id = bua.app_id
where app.slug = 'cellar'
  and bu.email is not null
  and coalesce(bu.status, 'active') <> 'inactive'
on conflict (boh_user_id) do update
set email = excluded.email,
    role = excluded.role,
    status = 'active',
    updated_at = now();

revoke execute on function public.cellar_current_boh_user_id() from authenticated;
revoke execute on function public.cellar_current_boh_user_id() from anon;
revoke execute on function public.cellar_current_boh_user_id() from public;

commit;

select role, status, count(*) as count
from public.cellar_team_members
group by role, status
order by role, status;
