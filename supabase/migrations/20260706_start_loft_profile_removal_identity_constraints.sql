-- Start removing the legacy Loft public.profile dependency.
--
-- This migration is intentionally additive and non-breaking:
-- 1. Add canonical BOH/patron identity references alongside legacy profile_id references.
-- 2. Backfill those references from existing profile / loft_external_profile_link rows.
-- 3. Add name-required constraints for new/updated BOH and patron identities so UI/API flows
--    must complete onboarding instead of relying on display-name/full-name fallbacks.
--
-- A later migration can switch application code to these columns, validate constraints,
-- drop legacy profile FKs, and finally drop public.profile.

begin;

-- -----------------------------------------------------------------------------
-- Required identity names going forward
-- -----------------------------------------------------------------------------

alter table public.boh_user
  add constraint boh_user_first_name_required
  check (length(trim(coalesce(first_name, ''))) > 0) not valid;

alter table public.boh_user
  add constraint boh_user_last_name_required
  check (length(trim(coalesce(last_name, ''))) > 0) not valid;

alter table public.patron_person
  add constraint patron_person_first_name_required
  check (length(trim(coalesce(first_name, ''))) > 0) not valid;

alter table public.patron_person
  add constraint patron_person_last_name_required
  check (length(trim(coalesce(last_name, ''))) > 0) not valid;

-- -----------------------------------------------------------------------------
-- Canonical Loft identity references beside legacy profile references
-- -----------------------------------------------------------------------------

alter table public.loft_room
  add column if not exists host_boh_user_id uuid references public.boh_user(id),
  add column if not exists host_patron_person_id uuid references public.patron_person(id);

alter table public.loft_room_member
  add column if not exists boh_user_id uuid references public.boh_user(id),
  add column if not exists patron_person_id uuid references public.patron_person(id),
  add column if not exists guest_label text;

alter table public.loft_room_rsvp
  add column if not exists boh_user_id uuid references public.boh_user(id),
  add column if not exists patron_person_id uuid references public.patron_person(id);

alter table public.loft_question
  add column if not exists asker_boh_user_id uuid references public.boh_user(id),
  add column if not exists asker_patron_person_id uuid references public.patron_person(id);

alter table public.loft_room_waitlist
  add column if not exists approved_by_boh_user_id uuid references public.boh_user(id),
  add column if not exists approved_by_patron_person_id uuid references public.patron_person(id);

alter table public.host_application
  add column if not exists applicant_boh_user_id uuid references public.boh_user(id),
  add column if not exists applicant_patron_person_id uuid references public.patron_person(id),
  add column if not exists reviewed_by_boh_user_id uuid references public.boh_user(id),
  add column if not exists reviewed_by_patron_person_id uuid references public.patron_person(id);

-- -----------------------------------------------------------------------------
-- Backfill canonical BOH identity from public.profile for internal users.
-- public.profile.id was intentionally synced to public.boh_user.id in the compat bridge,
-- but auth_user_id/user_id is also handled for safety.
-- -----------------------------------------------------------------------------

update public.loft_room lr
set host_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where lr.host_profile_id = p.id
  and lr.host_boh_user_id is null;

update public.loft_room_member lrm
set boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where lrm.profile_id = p.id
  and lrm.boh_user_id is null;

update public.loft_room_rsvp r
set boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where r.profile_id = p.id
  and r.boh_user_id is null;

update public.loft_question q
set asker_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where q.asker_profile_id = p.id
  and q.asker_boh_user_id is null;

update public.loft_room_waitlist w
set approved_by_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where w.approved_by = p.id
  and w.approved_by_boh_user_id is null;

update public.host_application h
set applicant_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where h.profile_id = p.id
  and h.applicant_boh_user_id is null;

update public.host_application h
set reviewed_by_boh_user_id = bu.id
from public.profile p
join public.boh_user bu
  on bu.id = p.id
  or (bu.auth_user_id is not null and bu.auth_user_id = p.user_id)
where h.reviewed_by = p.id
  and h.reviewed_by_boh_user_id is null;

-- -----------------------------------------------------------------------------
-- Backfill canonical patron identity from loft_external_profile_link.
-- -----------------------------------------------------------------------------

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
-- Helpful indexes for the new canonical columns.
-- -----------------------------------------------------------------------------

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

commit;
