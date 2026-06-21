# Loft BOH dev migration inventory

Date: 2026-06-21
Task: t_7c641ca7
Repos inspected:
- BOH destination: `/home/jobzcafe/jobzcafe-boh` on `staging...origin/staging`
- JOBZCAFE source/reference: `/home/jobzcafe/jobzcafe-app` on `hermes-staging...origin/hermes-staging`

No secret values were read or printed. This inventory uses only source code, config names, and ticket/migration filenames.

## Current repo state

### BOH repo

`git status --short --branch` showed:

```text
## staging...origin/staging
 M supabase/.temp/gotrue-version
 M supabase/.temp/pooler-url
 M supabase/.temp/postgres-version
 M supabase/.temp/project-ref
 M supabase/.temp/rest-version
 M supabase/.temp/storage-migration
 M supabase/.temp/storage-version
?? docs/
?? supabase/manual_sql/20260619_add_australis_counter_ticket_central_call_request.sql
?? supabase/manual_sql/20260619_create_australis_build_management_records_boh_dev.sql
?? supabase/manual_sql/20260619_verify_boh_tenant_foundation.sql
?? supabase/migrations/20260619_add_boh_tenant_foundation.sql
```

Notes:
- BOH is already on `staging`, which matches the repo guidance source of truth.
- The working tree was dirty before this inventory. Do not overwrite the listed pre-existing untracked/modified files.
- This inventory added only this document.

### JOBZCAFE app/source repo

`git status --short --branch` showed:

```text
## hermes-staging...origin/hermes-staging
 M supabase/.temp/cli-latest
?? WALKTHROUGH_VIDEO_PRODUCTION_GUIDE.md
?? supabase/.temp/linked-project.json
?? supabase/migrations/20260531_studio_counter_ticket_updates.sql
```

Notes:
- The source repo also has pre-existing dirty state.
- Source `supabase/config.toml` points at project id `jmjrgthqnrebzflythvj` and does not currently list the Loft functions in function-specific config sections.

## JOBZCAFE app/source inventory

### Frontend Loft entry points

| Source file | Current role | BOH destination/owner |
|---|---|---|
| `/home/jobzcafe/jobzcafe-app/src/utils/loft.ts` | Redirect helper. Defines `LOFT_APP_URL = import.meta.env.VITE_LOFT_APP_URL || 'https://loft.jobzcafe.com'`, iOS/mobile helpers, `buildLoftUrl`, and `openLoft`. | Replace redirect semantics with BOH-owned Loft routing. Keep only if BOH needs a temporary migration redirect helper. New BOH-owned module should live under `/home/jobzcafe/jobzcafe-boh/src/apps/loft/`. |
| `/home/jobzcafe/jobzcafe-app/src/components/shared/OpenLoftModal.tsx` | iOS install/continue modal for the standalone Loft PWA. It assumes Loft remains its own app and sends users to `LOFT_APP_URL`. | Likely do not migrate as-is. If BOH still needs PWA instructions, rewrite copy around BOH Suite Loft; otherwise remove from migration scope. |
| `/home/jobzcafe/jobzcafe-app/src/App.tsx` | Imports `OpenLoftModal`, `isIOS`, `openLoft`; has `ExternalLoftRedirect`; routes `/loft`, `/loft/create`, `/loft/room/:id`, and `/loft/*` redirect externally. | BOH already owns `/loft/*` routing in `/home/jobzcafe/jobzcafe-boh/src/App.tsx`. Migration should implement real BOH Loft pages under that route instead of preserving external redirect behavior. |
| `/home/jobzcafe/jobzcafe-app/src/lib/types/subscription.ts` and `/home/jobzcafe/jobzcafe-app/src/lib/types/supabase.ts` | Type definitions include shared Loft/profile fields: `loft_orientation_completed_at`, `personal_room_id`, `can_host_loft`, `is_loft_admin`, `can_use_personal_room`, `personal_room_slug`, `personal_room_public`, and `background_mode`. | BOH DB/type layer needs equivalent fields against the BOH dev schema if Loft remains profile-owned. Since BOH identity guidance says app ownership should use `public.boh_user.id`, implementation should decide whether these remain on shared `profile` during transition or are adapted to BOH users/Patron identity. |
| Icons such as `src/components/icons/LoftsIcon.tsx`, `src/components/icons/mentor/MentorLoftsIcon.tsx`, `src/components/icons/coach/CoachLoftsIcon.tsx`, `src/components/icons/journey/JourneyLoftsIcon.tsx`, plus feature card references in dashboard/menu files | Studio/customer-app navigation affordances into Loft. | BOH already has `DefaultIcons.Loft`; do not blindly copy customer-app icons unless the BOH visual system needs them. |

### Source Edge Functions

| Source function | Purpose | Env variable NAMES seen | BOH destination/owner |
|---|---|---|---|
| `/home/jobzcafe/jobzcafe-app/supabase/functions/loft-create-room/index.ts` | Authenticated scheduled/public/private room creation; creates Daily room; inserts `loft_room`; inserts host into `loft_room_member`. | `SUPABASE_URL`, `STUDIO_SUPABASE_ADMIN_KEY`, `STUDIO_SUPABASE_PUBLISHABLE_KEY`, `DAILY_API_KEY`, `STUDIO_APP_URL` | BOH does not currently have `loft-create-room`. Add/adapt as BOH function if scheduled room creation is part of BOH Loft MVP. Use BOH naming conventions: `SB_SECRET_KEY` and `SB_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY` rather than Studio-prefixed secrets, and shared CORS helper. |
| `/home/jobzcafe/jobzcafe-app/supabase/functions/loft-join-token/index.ts` | Creates Daily meeting token for a `loft_room`, with public-room anonymous support and private membership checks. | `SUPABASE_URL`, `STUDIO_SUPABASE_ADMIN_KEY`, `STUDIO_SUPABASE_PUBLISHABLE_KEY`, `DAILY_API_KEY`, `STUDIO_APP_URL` | BOH already has a richer `supabase/functions/loft-join-token/index.ts`; keep BOH version as the base. It requires auth for all joins, supports `unlisted`, marks host-started rooms live/open, hydrates members/current user/host details, and uses BOH env names. |
| `/home/jobzcafe/jobzcafe-app/supabase/functions/loft-rsvp/index.ts` | Authenticated RSVP/cancel flow; upserts `loft_room_rsvp`; inserts/deletes listener membership; optionally records RSVP question in `loft_question`. | `SUPABASE_URL`, `STUDIO_SUPABASE_ADMIN_KEY`, `STUDIO_SUPABASE_PUBLISHABLE_KEY`, `STUDIO_APP_URL` | BOH does not currently have `loft-rsvp`. Add/adapt if scheduled/non-personal Loft rooms need attendee RSVP. Use BOH env names and BOH auth/profile resolution. |

### Source migrations/config/assets

- Source migrations inspected: only four files under `/home/jobzcafe/jobzcafe-app/supabase/migrations/`; no Loft schema migration was found there by searching `loft_room`, `personal_room`, `loft_`, or `waitlist`.
- Source `supabase/config.toml` currently lists only several non-Loft functions; no `[functions.loft-*]` entries were found.
- No source asset files with `loft` in the file name were found by file-name search. Source has Loft icon components and copy references, but no obvious Loft image/video assets in this repo.
- `HERMES_CODEX_HANDOVER.md` says "Loft implementation lives in `loft`" and lists frontend-safe Vite variable names including `VITE_LOFT_APP_URL`; that suggests this repo is mostly a JOBZCAFE customer-app redirect/integration surface, not the complete standalone Loft app.

## Existing BOH inventory

### BOH frontend/module state

| BOH file | Current role | Keep/adapt |
|---|---|---|
| `/home/jobzcafe/jobzcafe-boh/src/App.tsx` | Imports `LoftApp` and protects route `<Route path="/loft/*" element={renderProtectedRoute(<LoftApp isAdmin={isSuperAdmin} />)} />`. | Keep. This is the correct BOH-owned route surface. |
| `/home/jobzcafe/jobzcafe-boh/src/apps/loft/LoftApp.tsx` | Placeholder BOH shell: shows "Loft" and "Inventory and resource management. Coming soon." | Replace with real Loft BOH module pages. It currently has no room/session UI and no Supabase calls. |
| `/home/jobzcafe/jobzcafe-boh/src/boh/navigation/appConfigs.ts` | Defines `loftNavConfig`, but `bohApps` entry for Loft has `route: ''`, `isExternal: true`, and external URL switching between `https://loft.jobzcafe.com` and `https://dev-loft.jobzcafe.com`. | Change in implementation card: set Loft to internal route `/loft`, attach `navConfig: loftNavConfig`, remove external URL behavior once BOH Loft UI is ready. Also update Dashboard external URL mapping. |
| `/home/jobzcafe/jobzcafe-boh/src/apps/boh/pages/DashboardPage.tsx` | Has `externalUrlBySlug.loft = getExternalAppUrl('https://loft.jobzcafe.com', 'https://dev-loft.jobzcafe.com')`. | Change in implementation card so dashboard opens internal `/loft` when Loft is BOH-owned. |

### BOH Edge Functions already present

| BOH function | Current purpose/notes | Env variable NAMES seen |
|---|---|---|
| `supabase/functions/loft-join-token/index.ts` | Richer than source app version. Creates Daily token; requires authenticated user; resolves `profile` from auth `user_id`; checks private membership; starts/opens host room; returns members/currentUserProfile/hostDetails. | `SUPABASE_URL`, `SB_SECRET_KEY`, `SUPABASE_ANON_KEY`, `DAILY_API_KEY` |
| `supabase/functions/get-or-create-personal-room/index.ts` | Authenticated host personal room creation/reuse. Requires `profile.can_use_personal_room`; creates Daily room `loft-personal-<profileId>`; inserts `loft_room`; updates `profile.personal_room_id`; adds host member. | `SUPABASE_URL`, `SB_SECRET_KEY`, `SUPABASE_ANON_KEY`, `DAILY_API_KEY` |
| `supabase/functions/get-personal-room-by-slug/index.ts` | Looks up profile by `personal_room_slug` and returns room id/title. Logging is verbose and returns more existence detail than `join-personal-room-by-slug`. | `SUPABASE_URL`, `SB_SECRET_KEY` |
| `supabase/functions/join-personal-room-by-slug/index.ts` | Public/guest join by personal room slug. Includes in-memory IP rate limiting, slug/name sanitization, privacy checks, Daily token generation, and audit insert to `loft_room_join_logs`. | `SUPABASE_URL`, `SB_SECRET_KEY`, `DAILY_API_KEY` |
| `supabase/functions/get-personal-room-waitlist/index.ts` | Present; not read in full for this inventory, but search confirms waitlist related code exists. | Not inventoried in detail; inspect before implementation. |
| `supabase/functions/approve-waitlist-entry/index.ts` and `supabase/functions/reject-waitlist-entry/index.ts` | Present; likely host/admin waitlist moderation. | Not inventoried in detail; inspect before implementation. |

BOH `supabase/config.toml` already has `verify_jwt = false` entries for:
- `get-or-create-personal-room`
- `get-personal-room-by-slug`
- `get-personal-room-waitlist`
- `join-personal-room-by-slug`
- `loft-join-token`
- `approve-waitlist-entry`
- `reject-waitlist-entry`

Missing from BOH config/functions relative to source app:
- `loft-create-room`
- `loft-rsvp`

### BOH migrations/manual SQL/tickets

- No BOH migration or manual SQL file was found containing `loft_room`, `personal_room`, `loft_`, `waitlist`, `DAILY_API_KEY`, or `SB_SECRET_KEY` under `supabase/migrations` or `supabase/manual_sql`.
- BOH has several Loft Counter ticket SQL artifacts under `tickets/`, including:
  - `tickets/2026-05-06-loft-session-layout-cors/*`
  - `tickets/2026-05-08-loft-personal-table-invite/*`
  - `tickets/2026-05-17-loft-personal-tables-admin/*`
  - `tickets/2026-05-22-loft-personal-table-live-qa/*`
- Ticket notes indicate prior Loft work existed outside BOH source, including personal table invite workflow, admin personal tables, layout/CORS hardening, waitlist cleanup, and Daily join QA. Treat these as historical handoff clues, not schema source of truth.

## Concrete migration map

### Phase 1: Lock BOH as Loft owner and remove external routing

1. In `/home/jobzcafe/jobzcafe-boh/src/boh/navigation/appConfigs.ts`:
   - Change the `bohApps` Loft entry from external/hybrid to internal route `/loft` with `navConfig: loftNavConfig`.
   - Keep category decision product-owned; likely `internal` while BOH-only.
2. In `/home/jobzcafe/jobzcafe-boh/src/apps/boh/pages/DashboardPage.tsx`:
   - Remove Loft from `externalUrlBySlug` or special-case it to internal `/loft`.
3. Keep `/home/jobzcafe/jobzcafe-boh/src/App.tsx` route `/loft/*`; it is already correct.
4. Do not delete source JOBZCAFE redirect files yet. Later source cleanup can change JOBZCAFE app `/loft` links to BOH Suite/deep links once BOH Loft is live.

### Phase 2: Build the BOH Loft frontend module

Owner directory: `/home/jobzcafe/jobzcafe-boh/src/apps/loft/`

Recommended initial pages/components:
- `LoftApp.tsx`: expand from placeholder to BOH shell routes.
- `pages/LoftDashboardPage.tsx`: room overview, personal-room status, quick actions.
- `pages/PersonalRoomPage.tsx`: host personal room creation/reuse, invite code/link, public/private slug state, waitlist state.
- `pages/LoftRoomPage.tsx`: authenticated Daily room join host/listener UI using `loft-join-token`.
- `pages/PersonalRoomPublicJoinPage.tsx` or a protected/public BOH route decision: guest join by slug currently has a public function but BOH `renderProtectedRoute` protects `/loft/*`, so guest routes may need a separate unauthenticated route if public joins remain part of BOH Loft.
- `lib/loftApi.ts`: typed wrappers for Supabase functions (`get-or-create-personal-room`, `loft-join-token`, `join-personal-room-by-slug`, waitlist functions; later `loft-create-room`/`loft-rsvp`).
- `types.ts`: room/member/waitlist response types.

Key implementation decision:
- BOH identity guidance says BOH app data should use `public.boh_user.id`, but the existing Loft functions resolve and compare shared `profile.id` from Supabase Auth `user.id`. The next card must either:
  1. Preserve profile-based Loft tables temporarily and document this as a transition boundary, or
  2. Migrate/adapt Loft tables and functions to BOH `boh_user` ownership before frontend buildout.

### Phase 3: Supabase schema/migrations for BOH-DEV

Create an additive BOH dev migration after confirming actual BOH-DEV schema. Based on function references, BOH-DEV needs at least these objects/columns:

Tables/columns referenced:
- `public.profile`
  - `id`
  - `user_id`
  - `display_name`
  - `full_name`
  - `first_name`
  - `last_name`
  - `email`
  - `avatar_url`
  - `personal_room_id`
  - `can_use_personal_room`
  - `personal_room_slug`
  - `personal_room_public`
  - plus source type fields if retained: `loft_orientation_completed_at`, `can_host_loft`, `is_loft_admin`, `background_mode`
- `public.loft_room`
  - `id`
  - `app_context`
  - `host_profile_id`
  - `title`
  - `description`
  - `visibility` (`public`, `unlisted`, `private`)
  - `is_recorded`
  - `tags`
  - `daily_room_name`
  - `invite_code`
  - `status`
  - `is_open`
  - `opened_at`
  - `started_at`
  - `scheduled_start_at`
  - `scheduled_tz`
  - `max_participants` if scheduled rooms are retained
  - timestamps (`created_at`, `updated_at`) if not already present
- `public.loft_room_member`
  - `id`
  - `loft_room_id`
  - `profile_id`
  - `role`
  - `is_hand_raised`
  - uniqueness on `(loft_room_id, profile_id)` or equivalent if RSVP/member upsert logic expects duplicate protection
- `public.loft_room_join_logs`
  - `room_id`
  - `join_type`
  - `guest_name`
  - `slug_used`
  - `ip_address`
  - `user_agent`
  - `joined_at`
- `public.loft_room_rsvp` if migrating source `loft-rsvp`
  - `loft_room_id`
  - `profile_id`
  - `status`
  - unique `(loft_room_id, profile_id)`
- `public.loft_question` if retaining RSVP questions
  - `app_context`
  - `loft_room_id`
  - `asker_profile_id`
  - `is_anonymous`
  - `source`
  - `question_text`
  - `status`
- waitlist table(s) referenced by existing BOH waitlist functions; inspect before writing migration.

Migration safety:
- Additive-first only.
- Do not apply to production.
- Prefer BOH dev migration file under `/home/jobzcafe/jobzcafe-boh/supabase/migrations/` plus optional `supabase/manual_sql/*verify*` script if BOH-DEV manual application is required.

### Phase 4: Edge Function migration/adaptation

Keep/adapt existing BOH functions as the base:
- `loft-join-token`
- `get-or-create-personal-room`
- `get-personal-room-by-slug`
- `join-personal-room-by-slug`
- `get-personal-room-waitlist`
- `approve-waitlist-entry`
- `reject-waitlist-entry`

Add only if needed for MVP:
- `loft-create-room` adapted from source app to BOH env names and CORS helper.
- `loft-rsvp` adapted from source app to BOH env names and BOH identity/schema decision.

CORS/auth pattern for BOH functions:
- Existing BOH Loft functions import `corsHeaders` from `../_shared/cors.ts` and perform in-code auth; keep this pattern.
- Existing config uses `[functions.<name>] verify_jwt = false` for these in-code auth functions.

### BOH-DEV secret/env variable NAMES needed

Do not print values. A human should confirm/set only names below in BOH-DEV Supabase Edge Function secrets/dashboard:

Required by existing BOH Loft functions:
- `SUPABASE_URL`
- `SB_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `DAILY_API_KEY`

Potentially also needed if BOH frontend or local tooling calls Supabase directly:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Source-only names that should not be carried forward unless there is a deliberate compatibility shim:
- `STUDIO_APP_URL`
- `STUDIO_SUPABASE_ADMIN_KEY`
- `STUDIO_SUPABASE_PUBLISHABLE_KEY`
- `VITE_LOFT_APP_URL`

Human setup commands/checklist for BOH-DEV:

```bash
cd /home/jobzcafe/jobzcafe-boh
supabase link --project-ref <BOH_DEV_PROJECT_REF>
supabase secrets set \
  SB_SECRET_KEY=<boh-dev-service-role-or-secret-key> \
  SUPABASE_ANON_KEY=<boh-dev-anon-or-publishable-key> \
  DAILY_API_KEY=<daily-api-key>
```

`SUPABASE_URL` is normally provided by the Supabase runtime, but confirm it exists in the function environment if local serving/testing is used.

## Verification commands for the implementation card

Frontend/local app:

```bash
cd /home/jobzcafe/jobzcafe-boh
git status --short --branch
npm install --include=dev
npm run typecheck
npm run build
npm run dev -- --host 0.0.0.0
curl -I --max-time 5 http://127.0.0.1:5173/
```

Supabase function checks without exposing secrets:

```bash
cd /home/jobzcafe/jobzcafe-boh
supabase functions deploy get-or-create-personal-room --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-join-token --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy get-personal-room-by-slug --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy join-personal-room-by-slug --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy get-personal-room-waitlist --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy approve-waitlist-entry --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy reject-waitlist-entry --project-ref <BOH_DEV_PROJECT_REF>
```

If adding source-migrated functions:

```bash
supabase functions deploy loft-create-room --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-rsvp --project-ref <BOH_DEV_PROJECT_REF>
```

Suggested smoke tests after a dev user is available:
- Signed-in BOH user with personal-room permission calls `get-or-create-personal-room` and receives `roomId`, `dailyRoomName`, `title`, `inviteCode`, `isNew`.
- Same user calls `loft-join-token` with returned `roomId` and receives `token`, `dailyRoomName`, `role`, `currentUserProfile`, and `members`.
- Guest/public flow calls `join-personal-room-by-slug` with a valid public slug and guest name and receives token/daily room name without room id leakage.
- Private slug returns `room_private`/403.
- Bad/unknown slug returns generic not-found response.
- Waitlist approve/reject flows update membership and are visible in the BOH UI.

## Blockers / open decisions

1. The full standalone Loft frontend implementation is not in `/home/jobzcafe/jobzcafe-app`; that repo mainly has redirects, types, and three source Edge Functions. The complete Loft app may be in a separate `loft` repo referenced by `HERMES_CODEX_HANDOVER.md`.
2. BOH currently has no Loft schema migration/manual SQL source for `loft_room` and related tables. The next implementation card should inspect BOH-DEV schema directly or locate the standalone Loft schema source before writing migrations.
3. Identity model must be decided before deep implementation: keep legacy `profile.id` for Loft transition or migrate ownership to BOH `boh_user.id` per BOH guidance.
4. Public guest Personal Room join conflicts with BOH's currently protected `/loft/*` route. If public guest joins belong in BOH, add an explicit public route outside the protected BOH shell.
5. Existing BOH `get-personal-room-by-slug` has verbose logs/existence-detail responses; prefer the hardened `join-personal-room-by-slug` pattern for public surfaces.

## Commands run for this inventory

Representative commands/tools run:

```bash
git status --short --branch && git remote -v | sed 's#https://[^@]*@github.com/#https://github.com/#g'
```

Run in both:
- `/home/jobzcafe/jobzcafe-boh`
- `/home/jobzcafe/jobzcafe-app`

Repository searches/read operations:
- Searched `/home/jobzcafe/jobzcafe-app` for `loft`, `Loft`, `personal-room`, `personal_room`, `room_slug`, `join-personal`, `loft-`.
- Read source files: `src/utils/loft.ts`, `src/App.tsx`, `src/components/shared/OpenLoftModal.tsx`, source Loft functions, source package/config/handover files.
- Searched `/home/jobzcafe/jobzcafe-boh` for matching Loft/personal-room/function/schema terms.
- Read BOH files: `src/apps/loft/LoftApp.tsx`, `src/App.tsx` route matches, `src/boh/navigation/appConfigs.ts`, BOH Loft functions, `supabase/config.toml`, `package.json`, selected Loft ticket SQL notes.

No Supabase deploys, production operations, or secret reads were performed.
