-- Finish removing the legacy Loft public.profile dependency.
--
-- Preconditions enforced by this migration:
-- 1. Every legacy profile reference that carried identity has a canonical
--    public.boh_user or public.patron_person replacement.
-- 2. New canonical identity constraints are installed before legacy columns are
--    removed.
-- 3. RLS policies/RPCs no longer reference public.profile or display_name.
-- 4. The BOH -> profile sync trigger/function are removed before public.profile
--    is dropped.
--
-- This migration intentionally raises exceptions instead of silently deleting or
-- nulling unresolved identity relationships.

begin;

-- -----------------------------------------------------------------------------
-- Ensure canonical columns exist even if the previous additive migration was
-- partially applied in a development database.
-- -----------------------------------------------------------------------------

alter table public.loft_room
  add column if not exists host_boh_user_id uuid,
  add column if not exists host_patron_person_id uuid;

alter table public.loft_room_member
  add column if not exists boh_user_id uuid,
  add column if not exists patron_person_id uuid,
  add column if not exists guest_label text;

alter table public.loft_room_rsvp
  add column if not exists boh_user_id uuid,
  add column if not exists patron_person_id uuid;

alter table public.loft_question
  add column if not exists asker_boh_user_id uuid,
  add column if not exists asker_patron_person_id uuid;

alter table public.loft_room_waitlist
  add column if not exists approved_by_boh_user_id uuid,
  add column if not exists approved_by_patron_person_id uuid;

alter table public.host_application
  add column if not exists applicant_boh_user_id uuid,
  add column if not exists applicant_patron_person_id uuid,
  add column if not exists reviewed_by_boh_user_id uuid,
  add column if not exists reviewed_by_patron_person_id uuid;

-- Install canonical foreign keys as NOT VALID first so the migration remains
-- explicit about when validation happens.
do $$
begin
  if to_regclass('public.loft_room') is not null then
    alter table public.loft_room
      add constraint loft_room_host_boh_user_id_fkey
      foreign key (host_boh_user_id) references public.boh_user(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room') is not null then
    alter table public.loft_room
      add constraint loft_room_host_patron_person_id_fkey
      foreign key (host_patron_person_id) references public.patron_person(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_member') is not null then
    alter table public.loft_room_member
      add constraint loft_room_member_boh_user_id_fkey
      foreign key (boh_user_id) references public.boh_user(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_member') is not null then
    alter table public.loft_room_member
      add constraint loft_room_member_patron_person_id_fkey
      foreign key (patron_person_id) references public.patron_person(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_rsvp') is not null then
    alter table public.loft_room_rsvp
      add constraint loft_room_rsvp_boh_user_id_fkey
      foreign key (boh_user_id) references public.boh_user(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_rsvp') is not null then
    alter table public.loft_room_rsvp
      add constraint loft_room_rsvp_patron_person_id_fkey
      foreign key (patron_person_id) references public.patron_person(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_question') is not null then
    alter table public.loft_question
      add constraint loft_question_asker_boh_user_id_fkey
      foreign key (asker_boh_user_id) references public.boh_user(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_question') is not null then
    alter table public.loft_question
      add constraint loft_question_asker_patron_person_id_fkey
      foreign key (asker_patron_person_id) references public.patron_person(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_waitlist') is not null then
    alter table public.loft_room_waitlist
      add constraint loft_room_waitlist_approved_by_boh_user_id_fkey
      foreign key (approved_by_boh_user_id) references public.boh_user(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.loft_room_waitlist') is not null then
    alter table public.loft_room_waitlist
      add constraint loft_room_waitlist_approved_by_patron_person_id_fkey
      foreign key (approved_by_patron_person_id) references public.patron_person(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.host_application') is not null then
    alter table public.host_application
      add constraint host_application_applicant_boh_user_id_fkey
      foreign key (applicant_boh_user_id) references public.boh_user(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.host_application') is not null then
    alter table public.host_application
      add constraint host_application_applicant_patron_person_id_fkey
      foreign key (applicant_patron_person_id) references public.patron_person(id) on delete cascade
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.host_application') is not null then
    alter table public.host_application
      add constraint host_application_reviewed_by_boh_user_id_fkey
      foreign key (reviewed_by_boh_user_id) references public.boh_user(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.host_application') is not null then
    alter table public.host_application
      add constraint host_application_reviewed_by_patron_person_id_fkey
      foreign key (reviewed_by_patron_person_id) references public.patron_person(id) on delete set null
      not valid;
  end if;
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Backfill canonical BOH and Patron identities one final time.
-- -----------------------------------------------------------------------------

update public.loft_room lr
set host_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where lr.host_profile_id = p.id
  and lr.host_boh_user_id is null;

update public.loft_room_member lrm
set boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where lrm.profile_id = p.id
  and lrm.boh_user_id is null;

update public.loft_room_rsvp r
set boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where r.profile_id = p.id
  and r.boh_user_id is null;

update public.loft_question q
set asker_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where q.asker_profile_id = p.id
  and q.asker_boh_user_id is null;

update public.loft_room_waitlist w
set approved_by_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where w.approved_by = p.id
  and w.approved_by_boh_user_id is null;

update public.host_application h
set applicant_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where h.profile_id = p.id
  and h.applicant_boh_user_id is null;

update public.host_application h
set reviewed_by_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
  or (bu.email is not null and p.email is not null and lower(bu.email) = lower(p.email))
where h.reviewed_by = p.id
  and h.reviewed_by_boh_user_id is null;

update public.loft_room lr
set host_patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where lr.host_profile_id = lepl.profile_id
  and lr.host_boh_user_id is null
  and lr.host_patron_person_id is null;

update public.loft_room_member lrm
set patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where lrm.profile_id = lepl.profile_id
  and lrm.boh_user_id is null
  and lrm.patron_person_id is null;

update public.loft_room_rsvp r
set patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where r.profile_id = lepl.profile_id
  and r.boh_user_id is null
  and r.patron_person_id is null;

update public.loft_question q
set asker_patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where q.asker_profile_id = lepl.profile_id
  and q.asker_boh_user_id is null
  and q.asker_patron_person_id is null;

update public.loft_room_waitlist w
set approved_by_patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where w.approved_by = lepl.profile_id
  and w.approved_by_boh_user_id is null
  and w.approved_by_patron_person_id is null;

update public.host_application h
set applicant_patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where h.profile_id = lepl.profile_id
  and h.applicant_boh_user_id is null
  and h.applicant_patron_person_id is null;

update public.host_application h
set reviewed_by_patron_person_id = lepl.patron_person_id
from public.loft_external_profile_link lepl
where h.reviewed_by = lepl.profile_id
  and h.reviewed_by_boh_user_id is null
  and h.reviewed_by_patron_person_id is null;

-- -----------------------------------------------------------------------------
-- Remove legacy seeded Loft rooms that cannot map to BOH or Patron identity.
-- These were development seed profiles using +loft-seed@jobzcafe.local addresses,
-- not real users. They would otherwise block the profile drop by design.
-- -----------------------------------------------------------------------------

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_room_rsvp
where loft_room_id in (select id from seed_rooms)
   or profile_id in (select id from seed_profiles);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_room_member
where loft_room_id in (select id from seed_rooms)
   or profile_id in (select id from seed_profiles);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_question
where loft_room_id in (select id from seed_rooms)
   or asker_profile_id in (select id from seed_profiles);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_room_waitlist
where loft_room_id in (select id from seed_rooms)
   or approved_by in (select id from seed_profiles);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_room_join_logs
where room_id in (select id from seed_rooms);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
)
delete from public.host_application
where profile_id in (select id from seed_profiles)
   or reviewed_by in (select id from seed_profiles);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
), seed_rooms as (
  select id
  from public.loft_room
  where host_profile_id in (select id from seed_profiles)
)
delete from public.loft_room
where id in (select id from seed_rooms);

with seed_profiles as (
  select id
  from public.profile
  where (email ilike '%+loft-seed@jobzcafe.local' or email ilike '%+seed@jobzcafe.local')
    and nullif(trim(coalesce(first_name, '')), '') is null
    and nullif(trim(coalesce(last_name, '')), '') is null
)
delete from public.loft_external_profile_link
where profile_id in (select id from seed_profiles);

-- -----------------------------------------------------------------------------
-- Hard preflight: stop before destructive changes if any legacy identity remains
-- unresolved.
-- -----------------------------------------------------------------------------

do $$
declare
  unresolved_count integer;
begin
  select count(*) into unresolved_count
  from public.loft_room
  where host_profile_id is not null
    and host_boh_user_id is null
    and host_patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % loft_room.host_profile_id rows lack canonical host identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.loft_room_member
  where profile_id is not null
    and boh_user_id is null
    and patron_person_id is null
    and length(trim(coalesce(guest_label, ''))) = 0;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % loft_room_member.profile_id rows lack canonical member identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.loft_room_rsvp
  where profile_id is not null
    and boh_user_id is null
    and patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % loft_room_rsvp.profile_id rows lack canonical RSVP identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.loft_question
  where asker_profile_id is not null
    and asker_boh_user_id is null
    and asker_patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % loft_question.asker_profile_id rows lack canonical asker identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.loft_room_waitlist
  where approved_by is not null
    and approved_by_boh_user_id is null
    and approved_by_patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % loft_room_waitlist.approved_by rows lack canonical approver identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.host_application
  where profile_id is not null
    and applicant_boh_user_id is null
    and applicant_patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % host_application.profile_id rows lack canonical applicant identity', unresolved_count;
  end if;

  select count(*) into unresolved_count
  from public.host_application
  where reviewed_by is not null
    and reviewed_by_boh_user_id is null
    and reviewed_by_patron_person_id is null;
  if unresolved_count > 0 then
    raise exception 'Cannot drop public.profile: % host_application.reviewed_by rows lack canonical reviewer identity', unresolved_count;
  end if;
end $$;

-- Validate canonical FKs now that the preflight has passed.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conrelid::regclass as relation_name, conname
    from pg_constraint
    where conname in (
      'loft_room_host_boh_user_id_fkey',
      'loft_room_host_patron_person_id_fkey',
      'loft_room_member_boh_user_id_fkey',
      'loft_room_member_patron_person_id_fkey',
      'loft_room_rsvp_boh_user_id_fkey',
      'loft_room_rsvp_patron_person_id_fkey',
      'loft_question_asker_boh_user_id_fkey',
      'loft_question_asker_patron_person_id_fkey',
      'loft_room_waitlist_approved_by_boh_user_id_fkey',
      'loft_room_waitlist_approved_by_patron_person_id_fkey',
      'host_application_applicant_boh_user_id_fkey',
      'host_application_applicant_patron_person_id_fkey',
      'host_application_reviewed_by_boh_user_id_fkey',
      'host_application_reviewed_by_patron_person_id_fkey'
    )
  loop
    execute format('alter table %s validate constraint %I', constraint_record.relation_name, constraint_record.conname);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Canonical identity checks and indexes.
-- -----------------------------------------------------------------------------

alter table public.loft_room drop constraint if exists loft_room_host_identity_check;
alter table public.loft_room
  add constraint loft_room_host_identity_check
  check (num_nonnulls(host_boh_user_id, host_patron_person_id) <= 1)
  not valid;
alter table public.loft_room validate constraint loft_room_host_identity_check;

alter table public.loft_room_member drop constraint if exists loft_room_member_identity_check;
alter table public.loft_room_member
  add constraint loft_room_member_identity_check
  check ((case when boh_user_id is not null then 1 else 0 end)
       + (case when patron_person_id is not null then 1 else 0 end)
       + (case when length(trim(coalesce(guest_label, ''))) > 0 then 1 else 0 end) = 1)
  not valid;
alter table public.loft_room_member validate constraint loft_room_member_identity_check;

alter table public.loft_room_rsvp drop constraint if exists loft_room_rsvp_identity_check;
alter table public.loft_room_rsvp
  add constraint loft_room_rsvp_identity_check
  check (num_nonnulls(boh_user_id, patron_person_id) = 1)
  not valid;
alter table public.loft_room_rsvp validate constraint loft_room_rsvp_identity_check;

alter table public.loft_question drop constraint if exists loft_question_asker_identity_check;
alter table public.loft_question
  add constraint loft_question_asker_identity_check
  check (num_nonnulls(asker_boh_user_id, asker_patron_person_id) <= 1)
  not valid;
alter table public.loft_question validate constraint loft_question_asker_identity_check;

alter table public.loft_room_waitlist drop constraint if exists loft_room_waitlist_approver_identity_check;
alter table public.loft_room_waitlist
  add constraint loft_room_waitlist_approver_identity_check
  check (num_nonnulls(approved_by_boh_user_id, approved_by_patron_person_id) <= 1)
  not valid;
alter table public.loft_room_waitlist validate constraint loft_room_waitlist_approver_identity_check;

alter table public.host_application drop constraint if exists host_application_applicant_identity_check;
alter table public.host_application
  add constraint host_application_applicant_identity_check
  check (num_nonnulls(applicant_boh_user_id, applicant_patron_person_id) = 1)
  not valid;
alter table public.host_application validate constraint host_application_applicant_identity_check;

alter table public.host_application drop constraint if exists host_application_reviewer_identity_check;
alter table public.host_application
  add constraint host_application_reviewer_identity_check
  check (num_nonnulls(reviewed_by_boh_user_id, reviewed_by_patron_person_id) <= 1)
  not valid;
alter table public.host_application validate constraint host_application_reviewer_identity_check;

alter table public.host_application enable row level security;
alter table public.host_application force row level security;

drop policy if exists host_application_select_self_or_tenant on public.host_application;
create policy host_application_select_self_or_tenant
on public.host_application
for select
to authenticated
using (
  applicant_boh_user_id = private.current_boh_user_id()
  or reviewed_by_boh_user_id = private.current_boh_user_id()
  or private.current_boh_user_id() is not null
);

drop policy if exists host_application_insert_self on public.host_application;
create policy host_application_insert_self
on public.host_application
for insert
to authenticated
with check (applicant_boh_user_id = private.current_boh_user_id());

drop policy if exists host_application_update_reviewer on public.host_application;
create policy host_application_update_reviewer
on public.host_application
for update
to authenticated
using (private.current_boh_user_id() is not null)
with check (private.current_boh_user_id() is not null);

create index if not exists loft_room_host_boh_user_id_idx on public.loft_room(host_boh_user_id);
create index if not exists loft_room_host_patron_person_id_idx on public.loft_room(host_patron_person_id);
create index if not exists loft_room_member_boh_user_id_idx on public.loft_room_member(boh_user_id);
create index if not exists loft_room_member_patron_person_id_idx on public.loft_room_member(patron_person_id);
create index if not exists loft_room_rsvp_boh_user_id_idx on public.loft_room_rsvp(boh_user_id);
create index if not exists loft_room_rsvp_patron_person_id_idx on public.loft_room_rsvp(patron_person_id);
create index if not exists loft_question_asker_boh_user_id_idx on public.loft_question(asker_boh_user_id);
create index if not exists loft_question_asker_patron_person_id_idx on public.loft_question(asker_patron_person_id);
create index if not exists loft_room_waitlist_approved_by_boh_user_id_idx on public.loft_room_waitlist(approved_by_boh_user_id);
create index if not exists loft_room_waitlist_approved_by_patron_person_id_idx on public.loft_room_waitlist(approved_by_patron_person_id);
create index if not exists host_application_applicant_boh_user_id_idx on public.host_application(applicant_boh_user_id);
create index if not exists host_application_applicant_patron_person_id_idx on public.host_application(applicant_patron_person_id);
create index if not exists host_application_reviewed_by_boh_user_id_idx on public.host_application(reviewed_by_boh_user_id);
create index if not exists host_application_reviewed_by_patron_person_id_idx on public.host_application(reviewed_by_patron_person_id);

-- Reclassify legacy interview rooms that were incorrectly marked as Personal Rooms.
-- Personal Rooms must be one per BOH host; interview rooms are separate session rooms.
update public.loft_room lr
set room_origin = 'user_generated',
    business_context = coalesce(lr.business_context, 'interview'),
    tags = case
      when lr.tags @> array['interview-room']::text[] then lr.tags
      else array_append(coalesce(lr.tags, array[]::text[]), 'interview-room')
    end,
    updated_at = now()
from public.boh_user bu
where lr.tenant_id = bu.tenant_id
  and lr.room_origin = 'personal'
  and lr.status <> 'deleted'
  and lr.title ilike '%interview room%'
  and lr.host_boh_user_id = bu.id;

create unique index if not exists loft_room_one_active_personal_room_per_boh_host_uidx
  on public.loft_room (tenant_id, host_boh_user_id)
  where room_origin = 'personal'
    and status <> 'deleted'
    and tenant_id is not null
    and host_boh_user_id is not null;

create unique index if not exists loft_room_one_active_personal_room_per_patron_host_uidx
  on public.loft_room (tenant_id, host_patron_person_id)
  where room_origin = 'personal'
    and status <> 'deleted'
    and tenant_id is not null
    and host_patron_person_id is not null;

create unique index if not exists loft_room_member_room_boh_user_uidx
  on public.loft_room_member(loft_room_id, boh_user_id)
  where boh_user_id is not null;

create unique index if not exists loft_room_member_room_patron_person_uidx
  on public.loft_room_member(loft_room_id, patron_person_id)
  where patron_person_id is not null;

create unique index if not exists loft_room_member_room_guest_label_uidx
  on public.loft_room_member(loft_room_id, lower(trim(guest_label)))
  where guest_label is not null and length(trim(guest_label)) > 0;

create unique index if not exists loft_room_rsvp_room_boh_user_uidx
  on public.loft_room_rsvp(loft_room_id, boh_user_id)
  where boh_user_id is not null;

create unique index if not exists loft_room_rsvp_room_patron_person_uidx
  on public.loft_room_rsvp(loft_room_id, patron_person_id)
  where patron_person_id is not null;

create unique index if not exists host_application_one_pending_per_boh_applicant_uidx
  on public.host_application(applicant_boh_user_id)
  where status = 'pending' and applicant_boh_user_id is not null;

create unique index if not exists host_application_one_pending_per_patron_applicant_uidx
  on public.host_application(applicant_patron_person_id)
  where status = 'pending' and applicant_patron_person_id is not null;

-- Ensure name-required constraints exist before trying to validate them. Existing
-- dirty rows can keep them NOT VALID, but all newly inserted/updated rows are
-- protected.
do $$
begin
  alter table public.boh_user
    add constraint boh_user_first_name_required
    check (nullif(trim(coalesce(first_name, '')), '') is not null)
    not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.boh_user
    add constraint boh_user_last_name_required
    check (nullif(trim(coalesce(last_name, '')), '') is not null)
    not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.patron_person
    add constraint patron_person_first_name_required
    check (nullif(trim(coalesce(first_name, '')), '') is not null)
    not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.patron_person
    add constraint patron_person_last_name_required
    check (nullif(trim(coalesce(last_name, '')), '') is not null)
    not valid;
exception when duplicate_object then null;
end $$;

-- Validate name-required constraints installed by the previous/additive migration when the
-- data is already clean. If not clean, leave a clear notice rather than blocking
-- profile removal; the NOT VALID constraints still protect newly changed rows.
do $$
begin
  begin
    alter table public.boh_user validate constraint boh_user_first_name_required;
    alter table public.boh_user validate constraint boh_user_last_name_required;
  exception when check_violation then
    raise notice 'boh_user name-required constraints remain NOT VALID because existing rows need cleanup';
  end;

  begin
    alter table public.patron_person validate constraint patron_person_first_name_required;
    alter table public.patron_person validate constraint patron_person_last_name_required;
  exception when check_violation then
    raise notice 'patron_person name-required constraints remain NOT VALID because existing rows need cleanup';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- Recreate profile-dependent helpers and policies on canonical identity.
-- -----------------------------------------------------------------------------

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

-- Drop policies that reference legacy profile columns before the columns go away.
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

-- RPCs: keep signatures stable where practical, but derive labels only from
-- first_name || ' ' || last_name and canonical ids.
drop function if exists public.get_my_host_application_status();
create function public.get_my_host_application_status()
returns table (
  id uuid,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  admin_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_boh_user_id uuid;
begin
  select bu.id into current_boh_user_id
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
  limit 1;

  if current_boh_user_id is null then
    return;
  end if;

  return query
  select h.id, h.status, h.submitted_at, h.reviewed_at, h.admin_notes
  from public.host_application h
  where h.applicant_boh_user_id = current_boh_user_id
  order by h.submitted_at desc
  limit 1;
end;
$$;

drop function if exists public.get_host_applications(text);
create function public.get_host_applications(filter_status text default 'all')
returns table (
  id uuid,
  profile_id uuid,
  status text,
  application_reason text,
  experience_description text,
  topics_to_host text,
  applicant_persona text,
  requested_host_scope text,
  requested_audience text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_notes text,
  applicant_name text,
  applicant_email text,
  profile jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_is_admin boolean := false;
begin
  select public.is_boh_super_admin()
  into requester_is_admin;

  if not coalesce(requester_is_admin, false) then
    return;
  end if;

  return query
  select
    h.id,
    coalesce(h.applicant_boh_user_id, h.applicant_patron_person_id) as profile_id,
    h.status,
    h.application_reason,
    h.experience_description,
    h.topics_to_host,
    h.applicant_persona,
    h.requested_host_scope,
    h.requested_audience,
    h.submitted_at,
    h.reviewed_at,
    coalesce(h.reviewed_by_boh_user_id, h.reviewed_by_patron_person_id) as reviewed_by,
    h.admin_notes,
    case
      when bu.id is not null then trim(bu.first_name || ' ' || bu.last_name)
      when pp.id is not null then trim(pp.first_name || ' ' || pp.last_name)
      else null
    end as applicant_name,
    coalesce(bu.email, pp.email) as applicant_email,
    jsonb_strip_nulls(jsonb_build_object(
      'id', coalesce(h.applicant_boh_user_id, h.applicant_patron_person_id),
      'identity_type', case when bu.id is not null then 'boh_user' when pp.id is not null then 'patron_person' end,
      'first_name', coalesce(bu.first_name, pp.first_name),
      'last_name', coalesce(bu.last_name, pp.last_name),
      'email', coalesce(bu.email, pp.email),
      'avatar_url', null
    )) as profile
  from public.host_application h
  left join public.boh_user bu on bu.id = h.applicant_boh_user_id
  left join public.patron_person pp on pp.id = h.applicant_patron_person_id
  where filter_status is null
     or lower(filter_status) in ('all', '')
     or h.status = lower(filter_status)
  order by h.submitted_at desc;
end;
$$;

grant execute on function public.get_my_host_application_status() to authenticated;
grant execute on function public.get_host_applications(text) to authenticated;

drop function if exists public.request_personal_room_access(text, text, text, text);
create function public.request_personal_room_access(
  p_slug text,
  p_guest_name text,
  p_guest_email text default null,
  p_background_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  inserted_id uuid;
begin
  select lr.id into target_room_id
  from public.loft_room lr
  where lr.room_origin = 'personal'
    and (
      lower(lr.invite_code) = lower(p_slug)
      or lower(lr.daily_room_name) = lower(p_slug)
    )
  order by lr.created_at asc
  limit 1;

  if target_room_id is null then
    return jsonb_build_object('success', false, 'error', 'room_not_found');
  end if;

  insert into public.loft_room_waitlist (loft_room_id, guest_name, guest_email, background_mode, status)
  values (target_room_id, p_guest_name, p_guest_email, p_background_mode, 'pending')
  on conflict do nothing
  returning id into inserted_id;

  return jsonb_build_object('success', true, 'roomId', target_room_id, 'waitlistEntryId', inserted_id);
end;
$$;

drop function if exists public.check_guest_waitlist_status(text, text);
create function public.check_guest_waitlist_status(
  p_slug text,
  p_guest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  waitlist_row public.loft_room_waitlist%rowtype;
begin
  select lr.id into target_room_id
  from public.loft_room lr
  where lr.room_origin = 'personal'
    and (
      lower(lr.invite_code) = lower(p_slug)
      or lower(lr.daily_room_name) = lower(p_slug)
    )
  order by lr.created_at asc
  limit 1;

  if target_room_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into waitlist_row
  from public.loft_room_waitlist w
  where w.loft_room_id = target_room_id
    and lower(w.guest_name) = lower(p_guest_name)
  order by w.requested_at desc
  limit 1;

  if waitlist_row.id is null then
    return jsonb_build_object('status', 'none', 'roomId', target_room_id);
  end if;

  return jsonb_build_object('status', waitlist_row.status, 'roomId', target_room_id, 'waitlistEntryId', waitlist_row.id);
end;
$$;

grant execute on function public.request_personal_room_access(text, text, text, text) to anon, authenticated;
grant execute on function public.check_guest_waitlist_status(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Remove legacy profile foreign keys, unique indexes, columns, bridge sync, and
-- finally public.profile.
-- -----------------------------------------------------------------------------

-- Drop every FK that points at public.profile so non-default generated names do
-- not strand dependencies.
do $$
declare
  fk_record record;
begin
  for fk_record in
    select conrelid::regclass as relation_name, conname
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.profile'::regclass
  loop
    execute format('alter table %s drop constraint %I', fk_record.relation_name, fk_record.conname);
  end loop;
end $$;

-- Drop old uniqueness/indexes that are keyed by legacy profile columns.
drop index if exists public.loft_room_one_active_personal_room_per_host_uidx;
drop index if exists public.loft_room_host_profile_id_idx;
drop index if exists public.loft_room_member_profile_id_idx;
drop index if exists public.host_application_profile_id_idx;
drop index if exists public.host_application_one_pending_per_profile_idx;
drop index if exists public.loft_external_profile_link_profile_uidx;

alter table public.loft_room_member drop constraint if exists loft_room_member_loft_room_id_profile_id_key;
alter table public.loft_room_rsvp drop constraint if exists loft_room_rsvp_loft_room_id_profile_id_key;

alter table public.loft_room drop column if exists host_profile_id;
alter table public.loft_room_member drop column if exists profile_id;
alter table public.loft_room_rsvp drop column if exists profile_id;
alter table public.loft_question drop column if exists asker_profile_id;
alter table public.loft_room_waitlist drop column if exists approved_by;
alter table public.host_application drop column if exists profile_id;
alter table public.host_application drop column if exists reviewed_by;
alter table public.loft_external_profile_link drop column if exists profile_id;

-- Remove profile synchronization and profile-owned compatibility metadata.
drop trigger if exists sync_boh_user_to_profile on public.boh_user;
drop function if exists public.sync_boh_user_to_profile();

drop table if exists public.profile;

commit;
