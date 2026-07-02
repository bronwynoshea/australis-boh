begin;

create schema if not exists private;

grant usage on schema private to authenticated;

-- Normalize existing Personal Room rows so a deterministic DB invariant can be
-- enforced. Clubhouse/group/interview rooms can still be created separately.
update public.loft_room
set room_origin = 'personal',
    tags = case when tags @> array['personal-room']::text[] then tags else array_append(tags, 'personal-room') end,
    updated_at = now()
where tags @> array['personal-room']::text[]
  and room_origin is distinct from 'personal';

-- One active Personal Room per tenant + host profile. This is the persistent
-- Zoom-alternative link; other non-personal Loft rooms remain unrestricted by
-- this index.
create unique index if not exists loft_room_one_active_personal_room_per_host_uidx
on public.loft_room (tenant_id, host_profile_id)
where room_origin = 'personal'
  and status <> 'deleted'
  and tenant_id is not null
  and host_profile_id is not null;

create or replace function private.current_boh_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.id
  from public.profile p
  where p.user_id = auth.uid()
  order by p.created_at asc
  limit 1;
$$;

create or replace function private.current_boh_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(array_agg(distinct bu.tenant_id), '{}'::uuid[])
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
    and bu.tenant_id is not null;
$$;

create or replace function private.loft_room_is_accessible(room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with current_profile as (
    select private.current_boh_profile_id() as profile_id
  )
  select exists (
    select 1
    from public.loft_room lr, current_profile cp
    where lr.id = room_id
      and (
        lr.tenant_id = any(private.current_boh_tenant_ids())
        or (cp.profile_id is not null and lr.host_profile_id = cp.profile_id)
        or exists (
          select 1
          from public.loft_room_member lrm
          where lrm.loft_room_id = lr.id
            and lrm.profile_id = cp.profile_id
        )
      )
  );
$$;

revoke all on function private.current_boh_profile_id() from public, anon, authenticated;
revoke all on function private.current_boh_tenant_ids() from public, anon, authenticated;
revoke all on function private.loft_room_is_accessible(uuid) from public, anon, authenticated;
grant execute on function private.current_boh_profile_id() to authenticated;
grant execute on function private.current_boh_tenant_ids() to authenticated;
grant execute on function private.loft_room_is_accessible(uuid) to authenticated;

alter table public.loft_room enable row level security;
alter table public.loft_room_member enable row level security;
alter table public.loft_room_rsvp enable row level security;
alter table public.loft_room_waitlist enable row level security;
alter table public.loft_room_join_logs enable row level security;
alter table public.loft_question enable row level security;

-- Loft rooms: authenticated BOH users can read tenant rooms and rooms they host
-- or belong to. Mutations are still expected to happen via Edge Functions, but
-- host-scoped policies preserve legacy direct-client behavior during migration.
drop policy if exists "loft_room_select_authenticated_accessible" on public.loft_room;
create policy "loft_room_select_authenticated_accessible"
on public.loft_room
for select
to authenticated
using (private.loft_room_is_accessible(id));

drop policy if exists "loft_room_insert_authenticated_host_or_tenant" on public.loft_room;
create policy "loft_room_insert_authenticated_host_or_tenant"
on public.loft_room
for insert
to authenticated
with check (
  host_profile_id = private.current_boh_profile_id()
  or tenant_id = any(private.current_boh_tenant_ids())
);

drop policy if exists "loft_room_update_authenticated_host_or_tenant" on public.loft_room;
create policy "loft_room_update_authenticated_host_or_tenant"
on public.loft_room
for update
to authenticated
using (
  host_profile_id = private.current_boh_profile_id()
  or tenant_id = any(private.current_boh_tenant_ids())
)
with check (
  host_profile_id = private.current_boh_profile_id()
  or tenant_id = any(private.current_boh_tenant_ids())
);

-- Members.
drop policy if exists "loft_room_member_select_authenticated_accessible" on public.loft_room_member;
create policy "loft_room_member_select_authenticated_accessible"
on public.loft_room_member
for select
to authenticated
using (
  profile_id = private.current_boh_profile_id()
  or private.loft_room_is_accessible(loft_room_id)
);

drop policy if exists "loft_room_member_mutate_authenticated_self_or_host" on public.loft_room_member;
create policy "loft_room_member_mutate_authenticated_self_or_host"
on public.loft_room_member
for all
to authenticated
using (
  profile_id = private.current_boh_profile_id()
  or exists (
    select 1 from public.loft_room lr
    where lr.id = loft_room_id
      and lr.host_profile_id = private.current_boh_profile_id()
  )
)
with check (
  profile_id = private.current_boh_profile_id()
  or exists (
    select 1 from public.loft_room lr
    where lr.id = loft_room_id
      and lr.host_profile_id = private.current_boh_profile_id()
  )
);

-- RSVPs.
drop policy if exists "loft_room_rsvp_select_authenticated_self_or_room" on public.loft_room_rsvp;
create policy "loft_room_rsvp_select_authenticated_self_or_room"
on public.loft_room_rsvp
for select
to authenticated
using (
  profile_id = private.current_boh_profile_id()
  or private.loft_room_is_accessible(loft_room_id)
);

drop policy if exists "loft_room_rsvp_mutate_authenticated_self" on public.loft_room_rsvp;
create policy "loft_room_rsvp_mutate_authenticated_self"
on public.loft_room_rsvp
for all
to authenticated
using (profile_id = private.current_boh_profile_id())
with check (profile_id = private.current_boh_profile_id());

-- Waitlist: guests use Edge Functions; authenticated hosts/users only see their
-- own or hosted-room entries directly.
drop policy if exists "loft_room_waitlist_select_authenticated_host_or_self" on public.loft_room_waitlist;
create policy "loft_room_waitlist_select_authenticated_host_or_self"
on public.loft_room_waitlist
for select
to authenticated
using (
  user_id = auth.uid()
  or private.loft_room_is_accessible(loft_room_id)
);

drop policy if exists "loft_room_waitlist_insert_authenticated_self" on public.loft_room_waitlist;
create policy "loft_room_waitlist_insert_authenticated_self"
on public.loft_room_waitlist
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "loft_room_waitlist_update_authenticated_host_or_self" on public.loft_room_waitlist;
create policy "loft_room_waitlist_update_authenticated_host_or_self"
on public.loft_room_waitlist
for update
to authenticated
using (
  user_id = auth.uid()
  or private.loft_room_is_accessible(loft_room_id)
)
with check (
  user_id = auth.uid()
  or private.loft_room_is_accessible(loft_room_id)
);

-- Join logs are audit data. Hosts/tenant users can read; writes remain service-role.
drop policy if exists "loft_room_join_logs_select_authenticated_room" on public.loft_room_join_logs;
create policy "loft_room_join_logs_select_authenticated_room"
on public.loft_room_join_logs
for select
to authenticated
using (room_id is not null and private.loft_room_is_accessible(room_id));

-- Questions.
drop policy if exists "loft_question_select_authenticated_room" on public.loft_question;
create policy "loft_question_select_authenticated_room"
on public.loft_question
for select
to authenticated
using (loft_room_id is null or private.loft_room_is_accessible(loft_room_id));

drop policy if exists "loft_question_insert_authenticated_asker" on public.loft_question;
create policy "loft_question_insert_authenticated_asker"
on public.loft_question
for insert
to authenticated
with check (
  asker_profile_id = private.current_boh_profile_id()
  and (loft_room_id is null or private.loft_room_is_accessible(loft_room_id))
);

drop policy if exists "loft_question_update_authenticated_asker_or_room" on public.loft_question;
create policy "loft_question_update_authenticated_asker_or_room"
on public.loft_question
for update
to authenticated
using (
  asker_profile_id = private.current_boh_profile_id()
  or (loft_room_id is not null and private.loft_room_is_accessible(loft_room_id))
)
with check (
  asker_profile_id = private.current_boh_profile_id()
  or (loft_room_id is not null and private.loft_room_is_accessible(loft_room_id))
);

-- Trigger helper only; it should not be callable through PostgREST RPC.
do $$
begin
  if to_regprocedure('public.set_loft_external_profile_link_updated_at()') is not null then
    revoke execute on function public.set_loft_external_profile_link_updated_at() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.update_loft_video_session_updated_at()') is not null then
    revoke execute on function public.update_loft_video_session_updated_at() from public, anon, authenticated;
  end if;
end $$;

-- External profile links: direct browser reads are limited to the current BOH
-- profile/tenant. Writes remain service-role via BOH Edge Functions.
drop policy if exists "loft_external_profile_link_select_authenticated_self_or_tenant" on public.loft_external_profile_link;
create policy "loft_external_profile_link_select_authenticated_self_or_tenant"
on public.loft_external_profile_link
for select
to authenticated
using (
  profile_id = private.current_boh_profile_id()
  or tenant_id = any(private.current_boh_tenant_ids())
);

commit;
