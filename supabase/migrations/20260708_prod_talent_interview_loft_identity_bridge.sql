-- Production-safe BOH Loft identity bridge for Talent interview rooms.
-- Idempotently adds the canonical host/member identity columns and indexes that
-- current BOH Loft Edge Functions use for external Talent recruiter rooms.

begin;

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

alter table public.loft_video_session
  add column if not exists host_patron_person_id uuid references public.patron_person(id) on delete set null;

comment on column public.loft_video_session.host_patron_person_id is
  'External Patron person acting as session host, for Talent recruiters/coaches who are not BOH auth users. BOH users should continue using host_boh_user_id.';
comment on column public.loft_video_session.patron_person_id is
  'Primary external participant Patron person, typically job seeker/candidate/coachee.';

create index if not exists loft_room_host_boh_user_id_idx on public.loft_room(host_boh_user_id);
create index if not exists loft_room_host_patron_person_id_idx on public.loft_room(host_patron_person_id);
create index if not exists loft_video_session_host_patron_person_idx
  on public.loft_video_session(host_patron_person_id)
  where host_patron_person_id is not null;
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

create unique index if not exists loft_room_member_room_boh_user_uidx
  on public.loft_room_member(loft_room_id, boh_user_id)
  where boh_user_id is not null;
create unique index if not exists loft_room_member_room_patron_person_uidx
  on public.loft_room_member(loft_room_id, patron_person_id)
  where patron_person_id is not null;
create unique index if not exists loft_room_member_room_guest_label_uidx
  on public.loft_room_member(loft_room_id, lower(trim(guest_label)))
  where guest_label is not null and length(trim(guest_label)) > 0;

commit;
