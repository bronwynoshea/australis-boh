# Loft / JOBZCAFE® Video Session Bridge Architecture

Date: 2026-06-24
Repo: `/home/jobzcafe/australis-boh`
Source handoff: `/home/jobzcafe/australis-boh/docs/plans/loft-jobzcafe-architecture-session-handoff.md`

## Current checkpoint

The handoff decision still holds:

- **Loft owns the room mechanics**: Daily room names, join tokens, personal rooms, waitlists/admission, room lifecycle, in-room roles, hand raises, and technical join logs.
- **JOBZCAFE® / BOH / Talent own the business record**: recruiters, job seekers, patrons, appointments, coaching/onboarding context, RSVP/attendance/no-show, outcomes, notes, and reporting.
- **Slotz should remain link-level only for now**: an appointment can carry/send a Loft link, but Slotz does not need Loft-specific schema.
- **Zoom remains out of scope** for this phase.

I also found that Phase 1 has already been started locally via these untracked migrations:

- `supabase/migrations/20260624_add_loft_profile_compat_bridge.sql`
- `supabase/migrations/20260624_complete_loft_group_session_parity.sql`

Those migrations cover most of the previous Phase 1 audit findings: profile compatibility, group-session columns, member hand-raise/active state, waitlist timestamps/background mode, `loft_question.status='pending'`, host-application compatibility, and personal-room helper RPCs.

## Architecture decision for Phase 2

Create a BOH-owned bridge table named:

```sql
public.loft_video_session
```

Reason for this name:

- `video_session` is too generic for a repo with multiple apps and future possible providers.
- `appointment_video_link` is too Slotz-specific, and Slotz is intentionally not the owner.
- `talent_interview_session` is too Talent-specific, while Loft will also support onboarding/coaching/group sessions.
- `loft_session_link` underplays that this table is the JOBZCAFE® reporting/audit bridge, not just a URL holder.

`loft_video_session` should be treated as a **BOH/Talent business bridge to Loft**, not as Loft room internals.

## Updated host-room / Clubhouse creation decision

The earlier note said to avoid relying on the imported `host_application` workflow unless explicitly wanted. That needs refinement.

The product intent is that **some non-employee users may create Loft rooms themselves**, similar to Clubhouse:

- recruiters may create/host rooms
- job seekers may create/host rooms
- employees/admins may create/host official JOBZCAFE® sessions

So `host_application` or an equivalent host-eligibility workflow is not automatically dead code. It may be the right mechanism for user-generated rooms, provided it is adapted to JOBZCAFE® identity and moderation rules.

Recommended split:

1. **Official/business rooms**
   - created by BOH employees/admins or authorized Talent/recruiter workflows
   - tracked through `loft_video_session` when tied to interviews, appointments, onboarding, coaching, or reporting
   - permissioned by BOH/Talent roles

2. **User-generated Clubhouse-style rooms**
   - created by eligible recruiters/job seekers/community users
   - mostly Loft-native unless tied to a JOBZCAFE® business process
   - may use `host_application`, `can_host_loft`, `is_loft_admin`, or a future normalized host-permission table
   - should still be tenant-scoped and moderated

3. **Personal rooms**
   - reusable one-on-one rooms for recruiters/employees/job seekers where allowed
   - can be connected to `loft_video_session` when used for an interview/appointment/coaching flow

Important: allowing recruiters/job seekers to create rooms does **not** mean Loft becomes the source of truth for interviews or appointments. It only means Loft needs a host-permission and moderation model for self-created rooms.

## Ownership boundaries

### `loft_room`

Keep this focused on the technical/video room:

- Daily room identity
- room visibility/status/open/closed/ended state
- host profile compatibility while imported Loft functions remain profile-based
- group-session scheduling metadata
- personal-room access metadata
- room-level tags/description

Avoid adding recruiter/interview/job-seeker/business outcome fields here.

### `loft_video_session`

Use this for business/reporting linkage:

- tenant
- business context (`interview`, `coaching`, `onboarding`, `appointment`, `group_session`, etc.)
- optional source app (`talent`, `slotz`, `boh`, etc.)
- optional business record id/type
- host BOH user
- patron person / organisation links
- Loft room link
- participant-facing join URL/invite code snapshot
- delivery/status/outcome tracking
- timestamps for scheduled/sent/joined/completed/no-show

### Patron

Use `public.patron_person` and `public.patron_organisation` for job seeker / recruiter / business contact identity where available.

Do **not** create a parallel Loft guest/person table for business participants. Loft waitlist entries can still exist for technical admission, but reporting should resolve back to Patron/business records.

### Slotz

If Slotz creates a booking, link the booking to `loft_video_session.business_record_id` with:

```text
business_context = 'appointment'
source_app = 'slotz'
business_record_table = 'scheduling_bookings'
```

This avoids creating Slotz-specific Loft tables.

## Proposed table

```sql
create table if not exists public.loft_video_session (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  app_context text not null default 'boh',
  source_app text,

  loft_room_id uuid references public.loft_room(id) on delete set null,

  business_context text not null,
  business_record_table text,
  business_record_id uuid,

  host_boh_user_id uuid references public.boh_user(id) on delete set null,
  patron_person_id uuid references public.patron_person(id) on delete set null,
  patron_organisation_id uuid references public.patron_organisation(id) on delete set null,

  participant_name text,
  participant_email text,

  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,

  join_url text,
  invite_code text,

  message_status text not null default 'not_sent',
  status text not null default 'scheduled',
  outcome text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  link_sent_at timestamptz,
  first_joined_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_marked_at timestamptz,

  created_by uuid references public.boh_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint loft_video_session_business_context_check
    check (business_context in ('interview', 'coaching', 'onboarding', 'appointment', 'group_session', 'internal_meeting', 'other')),
  constraint loft_video_session_message_status_check
    check (message_status in ('not_sent', 'queued', 'sent', 'failed', 'cancelled')),
  constraint loft_video_session_status_check
    check (status in ('scheduled', 'link_sent', 'waiting', 'joined', 'completed', 'cancelled', 'no_show'))
);
```

## Recommended indexes

```sql
create index if not exists loft_video_session_tenant_status_idx
  on public.loft_video_session(tenant_id, status);

create index if not exists loft_video_session_loft_room_id_idx
  on public.loft_video_session(loft_room_id);

create index if not exists loft_video_session_host_idx
  on public.loft_video_session(host_boh_user_id);

create index if not exists loft_video_session_patron_person_idx
  on public.loft_video_session(patron_person_id);

create index if not exists loft_video_session_business_record_idx
  on public.loft_video_session(tenant_id, business_context, business_record_table, business_record_id);

create index if not exists loft_video_session_scheduled_start_idx
  on public.loft_video_session(tenant_id, scheduled_start_at desc);
```

## RLS direction

Enable RLS immediately.

Minimum first-pass policy:

- authenticated BOH users can select sessions for their current tenant
- BOH super admins can select all
- insert/update/delete should be restricted to super admins or users with Loft/Talent/Slotz operational permission once the permission model is settled

Suggested conservative first migration can grant only `select` through RLS and leave writes to service-role Edge Functions until workflows are implemented.

## Edge Function/API direction

Do not let the frontend assemble this from separate inserts initially. Create one service-role Edge Function later, for example:

```text
loft-create-video-session
```

Responsibilities:

1. Resolve current BOH user and tenant.
2. Resolve or create Patron person if participant email/name is supplied.
3. Get or create host personal `loft_room`, or attach selected group room.
4. Insert `loft_video_session`.
5. Return the business bridge row plus participant join URL/invite code.

A second function can later handle message delivery:

```text
loft-send-video-session-link
```

This keeps message sending out of Loft room creation and makes failures auditable via `message_status`.

## Talent recruiter interview flow

Recommended first production workflow:

1. Recruiter starts an interview/video link from Talent or BOH.
2. BOH resolves recruiter to `boh_user` and job seeker to `patron_person`.
3. BOH gets/creates recruiter personal `loft_room`.
4. BOH inserts `loft_video_session` with `business_context='interview'` and `source_app='talent'`.
5. BOH sends/stores the link through the existing messaging path.
6. Loft handles join/admission.
7. BOH updates `loft_video_session.status` and outcome fields.

## Slotz appointment flow

Recommended first workflow:

1. Slotz booking exists in `scheduling_bookings`.
2. BOH creates or attaches a `loft_video_session` row:
   - `business_context='appointment'`
   - `source_app='slotz'`
   - `business_record_table='scheduling_bookings'`
   - `business_record_id=<booking id>`
3. The booking confirmation/reminder message includes the Loft join URL.
4. Slotz does not need to own Loft state beyond the link/reference.

## Group room / onboarding flow

For employee-hosted onboarding/coaching sessions:

- If it is mostly Loft-native, keep RSVP/Q&A in Loft.
- If it is tied to a BOH business process, create `loft_video_session` rows for reporting/attendance/outcomes.
- For group sessions, `patron_person_id` can be null on the parent row; individual participant attendance can come later if needed through a separate child table.

## Later child table, only if needed

Do not add this until actual reporting needs it, but the likely next table would be:

```text
public.loft_video_session_participant
```

Use it only if a single business session needs multiple named participants with independent message/join/outcome tracking.

For now, one `loft_video_session` row per interview/appointment is enough.

## Implementation update

This direction is now reflected in code/migration work:

- `loft-create-room` now requires host eligibility (`can_host_loft`, Loft admin, or superadmin) before creating Clubhouse-style rooms.
- `submit-host-application` records applicant persona and requested host scope, and rejects self-service Personal Room requests.
- Host approval grants `can_host_loft` only. It does **not** grant `can_use_personal_room`.
- `get-or-create-personal-room` keeps Personal Rooms behind explicit `can_use_personal_room`, with copy clarifying that Personal Rooms are limited to JOBZCAFE® staff and recruiters.
- `loft-current-profile` hides Personal Room slug/id unless `can_use_personal_room` is true, while separately exposing `canCreateLoftRooms` for room hosting.
- New migration `20260624_loft_host_permissions_and_video_session_bridge.sql` adds host-application moderation metadata, room origin metadata, and `loft_video_session` for JOBZCAFE® business tracking.

## Open decisions after this bridge migration

1. Whether `source_app` should stay free text initially or reference `boh_app.slug`/`boh_app.id`.
2. Whether participant identity should support multiple people immediately or start with one `patron_person_id`.
3. Whether write access is service-role-only at first, or if authenticated BOH users get insert/update policies now.
4. Whether Talent will call BOH directly or whether BOH will expose a specific Talent-facing Edge Function.
5. Whether existing `host_application` compatibility should be hidden in BOH UI even though the imported functions/migration support it.

## Recommended next step

Create a reviewed additive migration for `public.loft_video_session` only, with tenant scoping and conservative RLS. Then add a small service-role Edge Function to create a bridge row for the recruiter/personal-room interview flow.

Avoid touching Slotz internals, Zoom/provider abstraction, or Talent app code until this bridge exists and is verified in BOH-DEV.
