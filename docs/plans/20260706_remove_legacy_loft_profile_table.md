# Remove Legacy Loft `profile` Table Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Remove the legacy `public.profile` Loft compatibility table and make BOH identity deterministic with no display-name fallbacks.

**Architecture:** `public.boh_user` becomes the canonical internal identity table. `public.patron_person` remains the canonical external person table. Loft tables move from `profile_id` references to explicit `boh_user_id`, `patron_person_id`, or guest fields. `public.profile` remains only during migration until every FK/code path has moved.

**Tech Stack:** Supabase Postgres migrations, Supabase Edge Functions, Vite/React BOH frontend, imported Loft app code.

---

## Current facts from BOH dev

- `public.boh_users` is a view, not a table:
  ```sql
  select id, full_name, email, status, created_at from boh_user;
  ```
- `public.profile` is a real table with RLS disabled and is flagged by Supabase Security Advisor.
- `public.profile` is referenced by these live FKs:
  - `host_application.profile_id`
  - `host_application.reviewed_by`
  - `loft_external_profile_link.profile_id`
  - `loft_question.asker_profile_id`
  - `loft_room.host_profile_id`
  - `loft_room_member.profile_id`
  - `loft_room_rsvp.profile_id`
  - `loft_room_waitlist.approved_by`
- Current BOH dev rows with missing first/last names exist, so hard `NOT NULL` cannot be validated immediately without onboarding cleanup.

---

## Target identity rules

### Internal BOH users

Canonical table:

```text
public.boh_user
```

Required fields after onboarding:

```text
first_name not blank
last_name not blank
```

Display label should be computed directly as:

```text
first_name || ' ' || last_name
```

No fallback to `display_name`, `full_name`, or email for active/onboarded BOH users.

### External people

Canonical table:

```text
public.patron_person
```

Required fields after external onboarding/intake:

```text
first_name not blank
last_name not blank
```

Display label should be computed directly as:

```text
first_name || ' ' || last_name
```

### Guests

Guests should not create BOH users, patron people, or profiles unless explicitly promoted/invited.

Use explicit guest fields only:

```text
guest_name
guest_email optional
```

---

## Phase 1: Add canonical Loft identity columns

**Migration created:**

```text
supabase/migrations/20260706_start_loft_profile_removal_identity_constraints.sql
```

This migration adds canonical identity columns alongside legacy `profile_id` columns:

- `loft_room.host_boh_user_id`
- `loft_room.host_patron_person_id`
- `loft_room_member.boh_user_id`
- `loft_room_member.patron_person_id`
- `loft_room_member.guest_label`
- `loft_room_rsvp.boh_user_id`
- `loft_room_rsvp.patron_person_id`
- `loft_question.asker_boh_user_id`
- `loft_question.asker_patron_person_id`
- `loft_room_waitlist.approved_by_boh_user_id`
- `loft_room_waitlist.approved_by_patron_person_id`
- `host_application.applicant_boh_user_id`
- `host_application.applicant_patron_person_id`
- `host_application.reviewed_by_boh_user_id`
- `host_application.reviewed_by_patron_person_id`

It also backfills these columns from:

- internal `profile -> boh_user`
- external `profile -> loft_external_profile_link -> patron_person`

And adds `NOT VALID` non-blank constraints for `boh_user.first_name`, `boh_user.last_name`, `patron_person.first_name`, and `patron_person.last_name`.

---

## Phase 2: Enforce onboarding names in UI/API

### Task 2.1: BOH onboarding gate

**Objective:** Active BOH users cannot continue into BOH/Loft unless first and last names are present.

**Files to inspect/modify:**

- `src/lib/bohAuth.ts`
- `src/boh/api/bohApi.ts`
- `src/apps/boh/pages/BohSettingsProfilePage.tsx`
- any current onboarding/profile completion page

**Required behavior:**

- If `boh_user.first_name` or `boh_user.last_name` is blank, route user to profile completion.
- Profile completion form requires both fields.
- Save to `boh_user.first_name`, `boh_user.last_name` only.
- Stop editing `boh_user.display_name` and `boh_user.full_name` directly from the UI.
- Optional generated column/view later can expose display label as first + last.

### Task 2.2: Patron onboarding/intake gate

**Objective:** External person records cannot be used for Loft sessions until first/last names exist.

**Files to inspect/modify:**

- `src/apps/patron/api/patronApi.ts`
- Talent/Patron intake flows that create `patron_person`
- `supabase/functions/loft-external-join-token/index.ts`
- `supabase/functions/loft-video-session-upsert/index.ts`

**Required behavior:**

- If a `patron_person` lacks first/last name, return a typed error like `patron_onboarding_incomplete`.
- Do not generate a label from email.
- Do not create `loft_external_profile_link` to paper over missing names.

---

## Phase 3: Switch Loft code to canonical identity columns

### Edge Functions

Modify these first:

- `supabase/functions/loft-get-or-create-personal-room/index.ts`
- `supabase/functions/loft-current-profile/index.ts`
- `supabase/functions/loft-join-token/index.ts`
- `supabase/functions/loft-join-personal-room-by-slug/index.ts`
- `supabase/functions/loft-get-personal-room-by-slug/index.ts`
- `supabase/functions/loft-get-personal-room-access/index.ts`
- `supabase/functions/get-personal-room-access/index.ts`
- `supabase/functions/loft-admin-list-personal-tables/index.ts`
- `supabase/functions/loft-external-join-token/index.ts`
- `supabase/functions/loft-video-session-upsert/index.ts`

Replace `profile_id` usage with:

```text
boh_user_id for BOH users
patron_person_id for external people
guest fields for public guests
```

### Frontend/imported Loft code

Modify:

- `imports/upstream-apps/loft-app/src/services/supabaseApi.ts`
- `imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage/**`
- `imports/upstream-apps/loft-app/src/components/Loft/AdminPersonalTables.tsx`

Stop typing user identity as generic `profile` where it means BOH user.

---

## Phase 4: Remove external profile bridge for BOH emails

Already partly patched in commit:

```text
cd59653 fix(loft): use internal BOH profiles for external joins
```

Next:

- Delete stale `loft_external_profile_link` rows where `primary_email` matches `boh_user.email` after confirming no active session depends on them.
- Change `loft_external_profile_link.profile_id` to no longer reference `profile`, or drop the table if patron identity columns fully replace it.

---

## Phase 5: Validate constraints and remove legacy columns

After UI/API gates are deployed and existing records are cleaned:

```sql
alter table public.boh_user validate constraint boh_user_first_name_required;
alter table public.boh_user validate constraint boh_user_last_name_required;
alter table public.patron_person validate constraint patron_person_first_name_required;
alter table public.patron_person validate constraint patron_person_last_name_required;
```

Then remove profile FKs in this order:

1. `loft_room_member.profile_id`
2. `loft_room_rsvp.profile_id`
3. `loft_question.asker_profile_id`
4. `loft_room_waitlist.approved_by`
5. `host_application.profile_id`
6. `host_application.reviewed_by`
7. `loft_room.host_profile_id`
8. `loft_external_profile_link.profile_id`

Only after those are gone:

```sql
drop trigger if exists sync_boh_user_to_profile on public.boh_user;
drop function if exists public.sync_boh_user_to_profile();
drop table public.profile;
```

---

## Verification checklist

Run before each commit/deploy:

```bash
npm run build
supabase db advisors --linked --type security --level info --fail-on none --output json
```

Browser verify:

- BOH login/onboarding with a user missing first/last name.
- BOH profile settings save first/last names.
- Loft Personal Table host join.
- Loft public copied invite link.
- Loft guest join.
- Loft admin personal table list.
- Talent/Patron external video session creation.
- A BOH user joining another host's room by email does not create `loft_external_profile_link`.

Database verify:

```sql
select count(*) from public.profile;
select count(*) from public.loft_room where host_profile_id is not null and host_boh_user_id is null and host_patron_person_id is null;
select count(*) from public.loft_room_member where profile_id is not null and boh_user_id is null and patron_person_id is null and guest_label is null;
select count(*) from public.loft_external_profile_link lepl join public.boh_user bu on lower(bu.email) = lower(lepl.primary_email);
```

Expected before final drop:

- `profile` count may still be non-zero.
- unresolved canonical identity counts should become zero.
- BOH-email external profile links should become zero.

Expected after final drop:

- Security Advisor no longer reports `public.profile` RLS disabled.
- App still passes browser smoke tests.
