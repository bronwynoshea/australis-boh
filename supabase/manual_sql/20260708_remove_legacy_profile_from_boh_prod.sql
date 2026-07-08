-- Align BOH production with BOH-DEV by removing the legacy public.profile model.
-- This is intentionally not a fallback. It copies any still-missing legacy values into canonical public.boh_user,
-- removes legacy profile foreign keys/columns left over from the old Loft model, then drops public.profile.

do $$
begin
  if to_regclass('public.profile') is not null then
    execute $sql$
      update public.boh_user bu
      set
        full_name = coalesce(nullif(trim(bu.full_name), ''), nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')),
        display_name = coalesce(nullif(trim(bu.display_name), ''), nullif(trim(p.display_name), ''), nullif(trim(p.full_name), '')),
        first_name = coalesce(
          nullif(trim(bu.first_name), ''),
          nullif(trim(p.first_name), ''),
          case
            when coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')) is null then null
            when array_length(regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'), 1) <= 1
              then coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), ''))
            else array_to_string(
              (regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'))
              [1:greatest(array_length(regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'), 1) - 1, 1)],
              ' '
            )
          end
        ),
        last_name = coalesce(
          nullif(trim(bu.last_name), ''),
          nullif(trim(p.last_name), ''),
          case
            when coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')) is null then null
            when array_length(regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'), 1) <= 1 then null
            else (regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'))
              [array_length(regexp_split_to_array(coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), '\s+'), 1)]
          end
        ),
        updated_at = now()
      from public.profile p
      where p.id = bu.id or lower(p.email) = lower(bu.email)
    $sql$;
  end if;
end $$;

alter table if exists public.loft_room drop constraint if exists loft_room_host_profile_id_fkey;
alter table if exists public.loft_room_member drop constraint if exists loft_room_member_profile_id_fkey;
alter table if exists public.loft_room_waitlist drop constraint if exists loft_room_waitlist_approved_by_fkey;
alter table if exists public.loft_room_rsvp drop constraint if exists loft_room_rsvp_profile_id_fkey;
alter table if exists public.loft_question drop constraint if exists loft_question_asker_profile_id_fkey;
alter table if exists public.host_application drop constraint if exists host_application_profile_id_fkey;
alter table if exists public.host_application drop constraint if exists host_application_reviewed_by_fkey;
alter table if exists public.loft_external_profile_link drop constraint if exists loft_external_profile_link_profile_id_fkey;

create or replace function private.current_boh_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select bu.id
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
  order by bu.created_at asc
  limit 1;
$$;

revoke all on function private.current_boh_user_id() from public, anon, authenticated;
grant execute on function private.current_boh_user_id() to authenticated;

create or replace function private.loft_room_is_accessible(room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with current_identity as (
    select private.current_boh_user_id() as boh_user_id
  )
  select exists (
    select 1
    from public.loft_room lr, current_identity ci
    where lr.id = room_id
      and (
        lr.tenant_id = any(private.current_boh_tenant_ids())
        or (ci.boh_user_id is not null and lr.host_boh_user_id = ci.boh_user_id)
        or exists (
          select 1
          from public.loft_room_member lrm
          where lrm.loft_room_id = lr.id
            and lrm.boh_user_id = ci.boh_user_id
        )
      )
  );
$$;

revoke all on function private.loft_room_is_accessible(uuid) from public, anon, authenticated;
grant execute on function private.loft_room_is_accessible(uuid) to authenticated;

drop policy if exists "loft_room_select_authenticated_accessible" on public.loft_room;
drop policy if exists "loft_room_insert_authenticated_host_or_tenant" on public.loft_room;
drop policy if exists "loft_room_update_authenticated_host_or_tenant" on public.loft_room;
drop policy if exists "loft_room_member_select_authenticated_accessible" on public.loft_room_member;
drop policy if exists "loft_room_member_mutate_authenticated_self_or_host" on public.loft_room_member;
drop policy if exists "loft_room_rsvp_select_authenticated_self_or_room" on public.loft_room_rsvp;
drop policy if exists "loft_room_rsvp_mutate_authenticated_self" on public.loft_room_rsvp;
drop policy if exists "loft_room_waitlist_select_authenticated_host_or_self" on public.loft_room_waitlist;
drop policy if exists "loft_room_waitlist_insert_authenticated_self" on public.loft_room_waitlist;
drop policy if exists "loft_room_waitlist_update_authenticated_host_or_self" on public.loft_room_waitlist;
drop policy if exists "loft_room_join_logs_select_authenticated_room" on public.loft_room_join_logs;
drop policy if exists "loft_question_select_authenticated_room" on public.loft_question;
drop policy if exists "loft_question_insert_authenticated_asker" on public.loft_question;
drop policy if exists "loft_question_update_authenticated_asker_or_room" on public.loft_question;
drop policy if exists "loft_external_profile_link_select_authenticated_self_or_tenant" on public.loft_external_profile_link;

drop function if exists private.current_boh_profile_id();

create policy "loft_room_select_authenticated_accessible"
on public.loft_room
for select
to authenticated
using (private.loft_room_is_accessible(id));

create policy "loft_room_insert_authenticated_host_or_tenant"
on public.loft_room
for insert
to authenticated
with check (
  host_boh_user_id = private.current_boh_user_id()
  or tenant_id = any(private.current_boh_tenant_ids())
);

create policy "loft_room_update_authenticated_host_or_tenant"
on public.loft_room
for update
to authenticated
using (
  host_boh_user_id = private.current_boh_user_id()
  or tenant_id = any(private.current_boh_tenant_ids())
)
with check (
  host_boh_user_id = private.current_boh_user_id()
  or tenant_id = any(private.current_boh_tenant_ids())
);

create policy "loft_room_member_select_authenticated_accessible"
on public.loft_room_member
for select
to authenticated
using (
  boh_user_id = private.current_boh_user_id()
  or private.loft_room_is_accessible(loft_room_id)
);

create policy "loft_room_member_mutate_authenticated_self_or_host"
on public.loft_room_member
for all
to authenticated
using (
  boh_user_id = private.current_boh_user_id()
  or exists (
    select 1 from public.loft_room lr
    where lr.id = loft_room_id
      and lr.host_boh_user_id = private.current_boh_user_id()
  )
)
with check (
  boh_user_id = private.current_boh_user_id()
  or exists (
    select 1 from public.loft_room lr
    where lr.id = loft_room_id
      and lr.host_boh_user_id = private.current_boh_user_id()
  )
);

create policy "loft_room_rsvp_select_authenticated_self_or_room"
on public.loft_room_rsvp
for select
to authenticated
using (
  boh_user_id = private.current_boh_user_id()
  or private.loft_room_is_accessible(loft_room_id)
);

create policy "loft_room_rsvp_mutate_authenticated_self"
on public.loft_room_rsvp
for all
to authenticated
using (boh_user_id = private.current_boh_user_id())
with check (boh_user_id = private.current_boh_user_id());

create policy "loft_room_waitlist_select_authenticated_host_or_self"
on public.loft_room_waitlist
for select
to authenticated
using (
  user_id = auth.uid()
  or private.loft_room_is_accessible(loft_room_id)
);

create policy "loft_room_waitlist_insert_authenticated_self"
on public.loft_room_waitlist
for insert
to authenticated
with check (user_id = auth.uid());

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

create policy "loft_room_join_logs_select_authenticated_room"
on public.loft_room_join_logs
for select
to authenticated
using (room_id is not null and private.loft_room_is_accessible(room_id));

create policy "loft_question_select_authenticated_room"
on public.loft_question
for select
to authenticated
using (loft_room_id is null or private.loft_room_is_accessible(loft_room_id));

create policy "loft_question_insert_authenticated_asker"
on public.loft_question
for insert
to authenticated
with check (
  asker_boh_user_id = private.current_boh_user_id()
  and (loft_room_id is null or private.loft_room_is_accessible(loft_room_id))
);

create policy "loft_question_update_authenticated_asker_or_room"
on public.loft_question
for update
to authenticated
using (
  asker_boh_user_id = private.current_boh_user_id()
  or (loft_room_id is not null and private.loft_room_is_accessible(loft_room_id))
)
with check (
  asker_boh_user_id = private.current_boh_user_id()
  or (loft_room_id is not null and private.loft_room_is_accessible(loft_room_id))
);

create policy "loft_external_profile_link_select_authenticated_self_or_tenant"
on public.loft_external_profile_link
for select
to authenticated
using (
  tenant_id = any(private.current_boh_tenant_ids())
);

alter table if exists public.loft_room drop column if exists host_profile_id;
alter table if exists public.loft_room_member drop column if exists profile_id;
alter table if exists public.loft_room_waitlist drop column if exists approved_by;
alter table if exists public.loft_room_rsvp drop column if exists profile_id;
alter table if exists public.loft_question drop column if exists asker_profile_id;
alter table if exists public.host_application drop column if exists profile_id;
alter table if exists public.host_application drop column if exists reviewed_by;
alter table if exists public.loft_external_profile_link drop column if exists profile_id;

drop table if exists public.profile;

select to_regclass('public.profile') as profile_table_after_drop;
