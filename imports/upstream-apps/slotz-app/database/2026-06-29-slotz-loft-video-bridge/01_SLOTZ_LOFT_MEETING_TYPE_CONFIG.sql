begin;

alter table public.scheduling_meeting_types
  add column if not exists loft_video_enabled boolean not null default false,
  add column if not exists loft_business_context text not null default 'appointment',
  add column if not exists loft_host_persona text not null default 'staff';

alter table public.scheduling_meeting_types
  drop constraint if exists scheduling_meeting_types_loft_business_context_check;

alter table public.scheduling_meeting_types
  add constraint scheduling_meeting_types_loft_business_context_check
  check (
    loft_business_context in (
      'interview',
      'coaching',
      'onboarding',
      'appointment',
      'group_session',
      'internal_meeting',
      'other'
    )
  );

alter table public.scheduling_meeting_types
  drop constraint if exists scheduling_meeting_types_loft_host_persona_check;

alter table public.scheduling_meeting_types
  add constraint scheduling_meeting_types_loft_host_persona_check
  check (loft_host_persona in ('recruiter', 'coach', 'staff'));

comment on column public.scheduling_meeting_types.loft_video_enabled is
  'When true, confirmed Slotz bookings for this meeting type create/update a BOH loft_video_session bridge row.';

comment on column public.scheduling_meeting_types.loft_business_context is
  'BOH Loft video-session business context for Slotz bookings, e.g. interview, coaching, onboarding, appointment.';

comment on column public.scheduling_meeting_types.loft_host_persona is
  'Expected Loft host persona for host Patron eligibility checks when using external Patron personal rooms.';

commit;
