# Loft / JOBZCAFE Architecture Discussion Handoff

Date: 2026-06-24
Repo: `/home/jobzcafe/australis-boh`
Context: BOH Loft database/schema audit plus architecture discussion for how Loft should support JOBZCAFE employees, Talent/recruiter interviews, Slotz appointment flows, and personal rooms.

## Purpose of this document

This is a session handoff for a future Hermes session. It captures the current direction and decisions from the Loft discussion so the next session can continue without re-litigating the basics.

## High-level decision

Loft should be the video/session-room layer, **not** the source of truth for JOBZCAFE appointments, patrons, job seekers, recruiters, interview records, RSVP/business tracking, or outcomes.

The source of truth for business workflow and reporting should remain in JOBZCAFE / BOH / Talent data models.

Loft should provide:

- Daily.co room creation/join token mechanics
- Personal rooms
- Employee-hosted group rooms / Clubhouse-style rooms
- Room open/close/live/ended state
- Admission/waitlist mechanics for personal rooms
- In-room roles such as host/speaker/listener/moderator
- Technical join logs
- Optional Q&A/hand raising for group rooms

JOBZCAFE / BOH / Talent should own:

- Patrons
- Job seekers
- Recruiters
- Employees/hosts
- Appointments
- Interview sessions and outcomes
- Coaching/onboarding business records
- Message delivery and message history
- RSVP/attendance/no-show tracking when tied to a business process
- Reporting and audit around interviews/coaching/onboarding

## Slotz decision

Do not over-integrate Slotz into Loft right now.

Current understanding:

- Any appointment creates or references a patron/job seeker record.
- The appointment/business context should live in JOBZCAFE/BOH/Talent.
- The system can send the participant a Loft link in the appointment/message.
- Loft only needs to provide the room/link/join experience.

Therefore, no Slotz-specific Loft tables are needed at this stage.

## Zoom decision

Leave Zoom out for now.

Reason:

- Keep the schema and workflows simple.
- Loft should be the default video layer for now.
- Zoom can be added later as an alternate provider if needed, but should not complicate the initial Loft integration.

## Primary Loft use cases

### 1. JOBZCAFE employee group rooms / Clubhouse-style sessions

Used by JOBZCAFE employees for things like:

- Onboarding sessions
- Coaching sessions
- Group info sessions
- Training sessions
- Office hours
- Internal or candidate-facing events

Likely needs:

- Employee/BOH user host
- Scheduled and/or live-now room support
- Room title/description/tags
- Visibility: public, unlisted, private
- Status: scheduled, live, ended, deleted
- Optional recurrence for repeated sessions
- Optional RSVP
- Optional Q&A
- Hand raising
- Speaker/listener/moderator roles
- Join/attendance logs

### 2. Personal rooms for one-on-one sessions

Used for:

- Recruiter/job seeker video interviews
- One-on-one coaching
- Internal one-on-ones
- Appointments created through Slotz or another workflow

Personal rooms should likely be reusable per host/recruiter/employee.

The actual appointment/interview/coaching record should point to or generate a Loft room/link, but the business record itself should not live in Loft.

## Talent app / recruiter interview direction

Recruiter video interviews with job seekers should be tracked in JOBZCAFE/Talent, not primarily in Loft.

Recommended flow:

1. Recruiter schedules or initiates interview from Talent/JOBZCAFE.
2. JOBZCAFE resolves the job seeker/patron and recruiter/host.
3. JOBZCAFE gets or creates the recruiter's Loft personal room.
4. JOBZCAFE creates a business tracking record, e.g. `video_session`, `interview_session`, or `appointment_video_link`.
5. JOBZCAFE sends the job seeker a Loft link in a message.
6. Job seeker joins through the Loft guest/personal-room link.
7. Recruiter admits/hosts the session.
8. Loft records technical join events.
9. JOBZCAFE/Talent updates business status such as link sent, joined, completed, cancelled, no-show, outcome, notes.

## Recommended bridge model

Use a JOBZCAFE/BOH-owned bridge table that connects business records to Loft rooms.

Potential table name options:

- `video_session`
- `loft_session_link`
- `appointment_video_link`
- `talent_interview_session`

Potential generalized schema:

```sql
create table public.video_session (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  app_context text not null default 'boh',
  loft_room_id uuid references public.loft_room(id) on delete set null,

  business_context text not null, -- e.g. 'interview', 'coaching', 'onboarding', 'appointment'
  business_record_id uuid,        -- appointment_id, interview_id, event_id, etc.

  host_boh_user_id uuid,
  patron_id uuid,
  job_seeker_id uuid,
  recruiter_id uuid,

  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,

  join_url text,
  invite_code text,

  status text not null default 'scheduled',
  -- possible statuses: scheduled, link_sent, waiting, joined, completed, cancelled, no_show

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

This is illustrative only. A future session should align exact foreign keys with the current BOH/Talent schema.

## Where RSVP/attendance should live

There are two categories:

### Internal/general Loft group rooms

For employee-hosted Clubhouse-style rooms that are mostly Loft-native, RSVP/Q&A can live in Loft:

- `loft_room_rsvp`
- `loft_question`
- `loft_room_member`
- `loft_room_join_logs`

### Business-linked sessions

For job seeker interviews, patron coaching, appointment-driven meetings, onboarding tied to programs, etc., RSVP/attendance/outcome should live in JOBZCAFE/BOH/Talent.

Loft can still log technical joins, but reporting should come from the business table/bridge.

## Host permissions direction

Updated clarification: the imported Loft `host_application` workflow may be relevant because Loft should support user-created rooms, similar to Clubhouse.

The product intent is that some non-employee users may be allowed to create/host rooms themselves:

- recruiters may create/host rooms
- job seekers may create/host rooms
- JOBZCAFE® employees/admins may create/host official sessions

Original imported Loft app includes:

- `host_application` table
- `loft-submit-host-application` function
- `loft-review-host-application` function
- RPCs such as `get_my_host_application_status` and `get_host_applications`

Recommended permission split:

- Official/business rooms should be granted through BOH/Talent roles and tracked in JOBZCAFE® when tied to interviews, appointments, onboarding, coaching, or reporting.
- User-generated Clubhouse-style rooms may use `host_application`, `can_host_loft`, `is_loft_admin`, or a future normalized host-permission table.
- Personal rooms can be allowed for recruiters/employees/job seekers where appropriate, but business tracking still belongs in JOBZCAFE®/BOH/Talent.

So the host-application feature is not automatically unnecessary. It should be evaluated as the moderation/eligibility workflow for recruiter/job-seeker-created Loft rooms, while BOH roles still cover official JOBZCAFE® rooms.

## Existing audit findings from current BOH Loft migration

Audited file:

- `supabase/migrations/20260621_add_loft_boh_dev_schema.sql`

Compared against imported Loft app/function requirements under:

- `imports/upstream-apps/loft-app`

### Current migration provides

- Adds Loft columns to `public.profile`:
  - `personal_room_id`
  - `can_use_personal_room`
  - `personal_room_slug`
  - `personal_room_public`
  - `can_host_loft`
  - `is_loft_admin`
  - `loft_orientation_completed_at`
  - `background_mode`
- Creates `public.loft_room`
- Creates `public.loft_room_member`
- Creates `public.loft_room_waitlist`
- Creates `public.loft_room_join_logs`
- Creates `public.loft_room_rsvp`
- Creates `public.loft_question`
- Registers Loft in `public.boh_app`

### Missing or incomplete Loft mechanics

#### `loft_room` missing columns used by imported functions

Needed by group sessions, recurrence, ending/cleanup, and personal-room compatibility:

- `recurrence_type`
- `recurrence_end_date`
- `recurrence_parent_id`
- `ended_at`
- `scheduled_delete_at`
- `access_mode`
- `scheduled_open_at`
- `scheduled_close_at`
- `public_join_enabled`

Imported functions impacted:

- `loft-create-room`
- `loft-update-room`
- `loft-end-room`
- `loft-cleanup-ended-rooms`
- older personal-room SQL RPCs

#### `loft_room_member` missing columns

Needed for live room participation state:

- `hand_raised_at`
- `is_active`
- `left_at`

Imported functions impacted:

- `loft-raise-hand`
- `loft-list-hand-raises`
- `loft-set-member-role`
- `loft-leave-room`

#### `loft_room_waitlist` partially compatible but missing columns/behavior

Missing columns from upstream fragments:

- `created_at`
- `updated_at`
- `user_id`
- `background_mode`

Potential constraint mismatch:

- Current BOH migration uses unique `(loft_room_id, guest_email)`.
- Imported personal-room flow often identifies guests by `guest_name` and only sometimes by email.
- If `guest_email` is null, duplicate name-only entries may not be prevented.
- Upstream schema used/expected unique `(loft_room_id, guest_name)`.

Also missing:

- `update_waitlist_updated_at()` trigger
- RLS policies/grants if direct browser/RPC waitlist access is required

#### `loft_question.status` mismatch

BOH migration allows:

- `submitted`
- `answered`
- `dismissed`

Imported `loft-rsvp` inserts:

- `pending`

Fix either the check constraint or the function.

#### Missing imported SQL RPC/helper functions

Not in BOH migration:

- `request_personal_room_access(p_slug text, p_guest_name text)`
- `check_guest_waitlist_status(p_slug text, p_guest_name text)`
- `get_personal_room_access(slug text, guestName text)`
- `get_room_access_status(p_room_id uuid, p_guest_name text)`
- `update_waitlist_updated_at()`

Some current Edge Functions duplicate this behavior directly, so a future session should decide whether to support these SQL RPCs or remove/deprecate frontend references.

#### `host_application` absent

Imported app includes host application UI/functions, but BOH migration does not create the table or RPCs.

Expected table columns from imported functions:

- `id`
- `profile_id`
- `status`
- `application_reason`
- `experience_description`
- `topics_to_host`
- `submitted_at`
- `reviewed_at`
- `reviewed_by`
- `admin_notes`

Frontend also references RPCs:

- `get_my_host_application_status`
- `get_host_applications(filter_status ...)`

Decision pending: probably do not need this if BOH role permissions replace host applications.

#### Potential `profile` vs `profiles` compatibility issue

Most imported functions use `public.profile`.

Some imported frontend auth code still queries `profiles` plural. If those paths are active, either:

- add a compatibility view/table, or
- update frontend to use the canonical BOH profile/current-profile function pattern.

#### Storage buckets referenced

Imported app references storage buckets:

- `avatars`
- `backgrounds`

These are not DB schema migrations but should be checked if full imported Loft UI is enabled.

## Recommended implementation phases

### Phase 1: Stabilize Loft mechanics only

Add missing columns and constraints needed for the selected Loft use cases:

- Personal rooms
- Employee group rooms
- Waitlist/admission
- Join logs
- Hand raise/speaker roles
- Room open/close/end/cleanup
- Optional recurrence if group sessions need repeats

Do not add Slotz-specific or Zoom-specific schema.

### Phase 2: Add JOBZCAFE business bridge/tracking

Create a BOH/Talent-owned tracking table for video sessions/interviews/appointments that points to Loft.

This should track:

- appointment/interview/event reference
- patron/job seeker/recruiter/host
- Loft room/link
- message/link sent state
- joined/completed/no-show/cancelled state
- outcome/reporting fields as needed

### Phase 3: Integrate Talent app/recruiter workflow

Talent app should call BOH/JOBZCAFE APIs/functions that:

- resolve recruiter/job seeker/patron
- get or create recruiter personal Loft room
- create a tracking bridge record
- send a Loft link to the job seeker
- update tracking state based on joins/completion/no-show

## Important guidance for future Hermes session

Do not blindly import every upstream Loft table/RPC. Some imported features are from the standalone Loft app and may not be appropriate for BOH/JOBZCAFE.

Prioritize the BOH/JOBZCAFE architecture:

- Loft = video room layer
- JOBZCAFE/Talent/BOH = business source of truth
- Slotz = can send/use Loft link, no deep integration yet
- Zoom = out of scope for now
- Host permissions = likely BOH roles, not Loft host applications

## Current session id

The current/recent Hermes session identified by session search was:

```text
20260624_100412_f01d48
```

Use this document as the primary handoff for the next session, rather than relying on transcript recovery.
