# Loft Change Ledger

## 2026-05-17 - Superadmin Personal Table administration

- Added a JOBZCAFE® superadmin-only Personal Tables admin surface for listing members with Personal Table access, enabling access by email, disabling access, copying guest links, and rotating guest invite codes.
- Added authenticated Edge Functions `loft-admin-list-personal-tables` and `loft-admin-manage-personal-table`; both enforce `user_type_id = 5` and do not grant access to external Loft admins.
- Clarified the app navigation split between Loft host-application administration and JOBZCAFE® superadmin Personal Table administration.
- Aligned Host Applications access so JOBZCAFE® superadmins can use the existing Loft admin review surface while Personal Table administration remains superadmin-only.
- Removed the old signed-in-member frontend shortcut for Personal Table access so the UI now reflects the explicit `can_use_personal_room`/existing-table grant.
- Auth boundary: new authenticated admin functions were added with JWT verification expected; no public `--no-verify-jwt` change was made.
- Database migration: none in this change. Existing `profile.can_use_personal_room`, `profile.personal_room_id`, and `loft_room.invite_code` fields are used without schema, RLS, or storage mutation.

## 2026-05-07 - Personal table guest lifecycle and app-origin links

- Fixed Personal Table guest identity so approved personal-link guests cannot inherit stale host state from another browser tab.
- Added a host-ended signal and guest status polling so guests are moved to the thank-you screen when the host ends the session.
- Kept Personal Table invite links tied to the current app URL so local, dev, and production links are generated from the active Loft app origin instead of a hardcoded host.
- Added a laptop-height-only Personal Table layout adjustment for compact transport spacing without changing taller desktop layouts.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-07 - Personal table public guest join CORS redeployed

- Set JOBZCAFE-dev Loft allowed origins for local Loft, dev Loft, and production Loft domains.
- Redeployed `loft-public-join-token` to JOBZCAFE-dev (`jmjrgthqnrebzflythvj`) after explicit approval with JWT verification disabled.
- Reason: invited guests call this function before login after the host welcomes them, so browser CORS must allow the active Loft origin and the function must remain public-safe.
- Updated `supabase/config.toml` to record `loft-public-join-token` as `verify_jwt = false` for future deploys.
- Verified preflight from `http://localhost:8081` returns `Access-Control-Allow-Origin: http://localhost:8081`.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-07 - Personal table close clears guest request list

- Updated authenticated Personal Room host close flow to explicitly clear `loft_room_waitlist` after ending the table.
- Hardened `loft-end-room` so personal tables are recognized by either the `personal-room` tag or host profile's `personal_room_id`.
- Host close now surfaces an explicit warning if the guest request list cannot be cleared automatically.
- Deployed `loft-end-room` to JOBZCAFE-dev (`jmjrgthqnrebzflythvj`) with JWT verification enabled.
- Auth boundary: no public access change was made for `loft-end-room`.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-07 - Dev deploy frontend Supabase key renamed to publishable key

- Updated the Loft frontend to require `VITE_SUPABASE_PUBLISHABLE_KEY` instead of `VITE_SUPABASE_ANON_KEY`.
- Updated `.env.example`, Vite build-time env presence checks, frontend Supabase client setup, and Edge Function browser-call headers to use the publishable key variable.
- Updated the local `.env` variable name without changing or printing the value.
- Purpose: align `dev-loft.jobzcafe.com` deployment variables with the Supabase publishable key naming used by JOBZCAFE-dev.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-06 - Edge Function CORS moved to explicit Loft origin config

- Removed hardcoded browser origin allowlists and wildcard `Access-Control-Allow-Origin` values from Loft Edge Functions.
- Updated all touched functions to use `supabase/functions/_shared/cors.ts`.
- Made `LOFT_ALLOWED_ORIGINS` the single required CORS source of truth, with no fallback origin and no alias fallback.
- Updated `.env.example` with local `8081`, Vite `5173`, `https://dev-loft.jobzcafe.com`, and `https://loft.jobzcafe.com` as the expected dev configuration values.
- Updated the no-silent-fallback guardrail to explicitly prohibit Edge Function CORS fallback origins.
- Removed Gemini model fallback/retry defaults from touched Loft Edge Functions; missing model config now fails explicitly.
- Auth boundary: no `--no-verify-jwt` change was made.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-06 - Personal Room recording starts real Daily cloud recordings

- Added `supabase/config.toml` for JOBZCAFE-dev with explicit JWT verification enabled for the authenticated Personal Room functions touched in this work.
- Updated `loft-join-token` so host Daily tokens explicitly allow cloud recording for solo webinar/presentation workflows.
- Updated the Personal Room chat footer so it explains that messages are visible to current participants and are not saved after the session ends.
- Replaced the raw remaining-character number with explicit `characters left` text.
- Updated `loft-toggle-recording` so authenticated hosts start/stop Daily cloud recording through the Daily REST API instead of only flipping the `loft_room.is_recorded` database flag.
- Updated recording failures to return and display safe host-facing messages instead of raw Edge Function wrapper text.
- Added host ownership validation to `loft-toggle-recording`; only the Personal Room host can change recording.
- Updated new Personal Room Daily room creation to enable cloud recording at the room level.
- Updated touched Edge Functions to prefer the JOBZCAFE-approved Supabase publishable/server secret env names while retaining compatibility with the current dev secret names.
- Auth boundary: no `--no-verify-jwt` change was made.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-06 - Personal Room waiting-room dismissal wired to authenticated close/leave paths

- Replaced dead frontend calls to the missing `remove-from-waitlist` function with `loft-update-guest-leave-status`.
- Scoped `loft-update-guest-leave-status` by `loftRoomId` and guest name so dismissals only affect the current Personal Room waiting-room table entries.
- Updated authenticated host close/leave paths (`loft-end-room`, `loft-leave-room`, and `loft-clear-room-waitlist`) to clear `loft_room_waitlist` rows for the room, with `loft-clear-room-waitlist` validating the current user is the room host.
- Auth boundary: no `--no-verify-jwt` change was made.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Dev onboarding session dates refreshed

- Updated seven JOBZCAFE-dev `loft_room` rows titled `Onboarding Session` so their `scheduled_start_at` values start on 2026-05-05 and continue weekly through 2026-06-16.
- Preserved existing room ids, host profile, status values, and `scheduled_tz = UTC`.
- Purpose: provide current dev data for validating Lobby visibility and card layout behavior.
- Database migration: none. This was a dev-only data correction, not a schema/RLS/function/storage change.

## 2026-05-05 - Personal Room guest links use invite code

- Clarified the Personal Room URL split: member/host access uses the authenticated Personal Room route, while external participants use the room invite code.
- Updated `loft-get-personal-room-by-slug` so `/personal/{code}` resolves `loft_room.invite_code` first, with legacy profile-slug resolution only for older links.
- Updated `loft-request-personal-room-access` and `loft-check-guest-waitlist-status` to resolve the invite code to the Personal Room before reading/writing `loft_room_waitlist`.
- Updated the host Personal Room page and lobby routing to copy/use the external guest invite code instead of the host/member `personal_room_slug`.
- Deployed `loft-request-personal-room-access` to JOBZCAFE-dev (`jmjrgthqnrebzflythvj`) with JWT verification disabled after explicit approval, because external participants must be able to request access before login.
- Remaining hardening: add per-invite/IP/email rate limiting to reduce spam on the public access-request endpoint.
- Purpose: host/member identity must not be conflated with the external participant link, especially before Slotz attaches bookings and appointments to Loft sessions.
- Database migration: none in this change.

## 2026-05-05 - Lobby keeps live reusable rooms visible

- Updated the Lobby client-side date filter so live rooms are not hidden because their original `scheduled_start_at` is before today.
- Purpose: reusable Personal Rooms can have old scheduled timestamps while still being live/open, so live status must win over date filtering.
- Database migration: none in this change.

## 2026-05-05 - Personal Room guest polling starts after host opens room

- Updated the public personal-room slug lookup to return only safe room-open metadata (`isOpen`, `openedAt`) in addition to room id/title.
- Updated the Personal Room guest waiting screen so approval-status polling does not start until the host opens/joins the Personal Room and `loft_room.is_open` is true.
- Before the host opens the room, guests remain on a quiet waiting screen with only a low-frequency host-open check.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Login stale-session UX and guest waiting restore

- Changed the Loft member login screen to clear stale local Supabase auth state silently instead of showing a confusing expired-session message before the user types anything.
- Updated the Personal Room guest gate to restore the pending waiting state after a page refresh when the guest has already requested access for the same personal-room slug.
- Database migration: none in this change.

## 2026-05-05 - Personal Room waiting poll reduced

- Reduced the Personal Room guest waiting screen approval polling from every 2 seconds to an initial short check followed by 8-second polling.
- Purpose: avoid excessive Edge Function and database reads when many guests are waiting for a host.
- Future improvement: replace polling with a Realtime waitlist event once the host/guest admission flow is hardened.
- Database migration: none in this change.

## 2026-05-05 - Edge Function auth boundary guardrail added

- Added the coding guardrail that existing Loft Edge Functions should be migrated away from legacy JWT assumptions when touched.
- Clarified the split between public-safe pre-login functions and authenticated functions.
- Deployed `loft-get-personal-room-by-slug` to JOBZCAFE-dev (`jmjrgthqnrebzflythvj`) with JWT verification disabled so public personal-room invite links can resolve safe metadata before the guest logs in or enters details.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Loft profile interaction pattern documented

- Added the coding guardrail that focused Loft account/settings surfaces should use desktop side drawers and mobile bottom sheets.
- Purpose: keep Profile as a focused name/photo editor rather than a full page or centered modal.
- Database migration: none in this change.

## 2026-05-05 - Current profile hydration moved behind Edge Function

- Added `supabase/functions/loft-current-profile/index.ts`.
- Updated the frontend profile/auth hydration to use `loft-current-profile` when direct browser profile reads do not return the member profile.
- Purpose: keep the browser out of direct `profile` table permission assumptions while still showing the logged-in member's Loft identity, host flags, admin flag, and Personal Room details.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Personal Room auth and function routing aligned

- Unified the root Supabase API/client modules with the active `src/services` modules so the shell, Profile, Lobby, and Personal Room use the same auth state.
- Updated the Loft auth listener to refresh on Supabase session events beyond only `SIGNED_IN` / `SIGNED_OUT`.
- Matched the browser profile lookup to the backend pattern by checking `profile.user_id = auth.user.id`, then `profile.id = auth.user.id`.
- Made Personal Room reachable for authenticated members while leaving permission enforcement to the `loft-get-or-create-personal-room` Edge Function.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Edge Function CORS aligned with Loft dev and registered URL

- Updated `supabase/functions/_shared/cors.ts` to allow the standalone Loft dev origins (`localhost` / `127.0.0.1` on 8081, 5173, and 3000), the staging Pages URL, and the registered Loft URL `https://loft.jobz.cafe`.
- Purpose: prevent browser-side CORS failures when the standalone Loft app calls Supabase Edge Functions such as `loft-join-token` from the local Vite server.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Lobby room listing moved behind Edge Function

- Added `supabase/functions/loft-list-rooms/index.ts`.
- Updated `services/supabaseApi.ts` so the lobby loads rooms via `loft-list-rooms` instead of direct browser reads from `loft_room` / `loft_room_with_counts`.
- Purpose: avoid RLS permission-denied failures for authenticated Loft users while keeping room visibility, RSVP state, host rooms, and participant counts enforced server-side.
- Database migration: none in this change. No table, RLS, storage, or schema mutation was made.

## 2026-05-05 - Supabase target moved back to environment config

- Removed hardcoded Supabase URL/anon-key fallback from `src/services/supabaseClient.ts`.
- Updated `.env.example` to require `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, and `VITE_API_BASE_URL`.
- Local development target should be JOBZCAFE-dev (`jmjrgthqnrebzflythvj`); production should be supplied by deployment environment later.
- Database migration: none in this change.

## 2026-05-05 - No silent fallback guardrail

- Added `docs/engineering-guardrails.md`.
- Guardrail: do not use silent fallbacks for configuration, auth, backend targets, permission checks, or required product data.
- Purpose: fallback values hide real integration problems and make dev/prod migration unsafe.
