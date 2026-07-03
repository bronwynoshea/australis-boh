# Loft Demo Readiness Notes

Last updated: 2026-05-06

This is the internal readiness companion to `docs/Loft User Guide.md`. Keep user-facing walkthrough instructions in the user guide. Keep implementation status, release caveats, Edge Function notes, environment variables, and open gaps here.

## Change Markup Since First Version

Legend:

- ~~Strikethrough~~ = item from an earlier Loft staging pass that has now been fixed or superseded.
- **Bold** = new item added after the first version.

Resolved or superseded items:

- ~~Loft Edge Functions allowed the standalone app by falling back to `app.jobzcafe.com`.~~ Loft CORS now uses explicit `LOFT_ALLOWED_ORIGINS` configuration with no fallback origin.
- ~~The session page made direct browser REST reads against `loft_room` and `loft_room_member`.~~ Session status and role access now use approved service/Edge Function paths.
- ~~The laptop layout allowed the transport bar to overlap the participant area.~~ Laptop-height treatment is now more compact and keeps the transport bar below the participant rail.
- ~~Participant cards sat on a visible tinted background panel.~~ The participant-card tint and edge overlays have been removed from Loft sessions and Personal Tables.
- ~~Listener cards showed controls listeners could not use.~~ Listener cards now recover space by hiding unnecessary mic/video controls unless the participant is promoted.

New items added after the first version:

- **Loft is now validated inside BOH at `/apps/loft`; standalone Loft hostnames are retired rather than redirected.**
- **The BOH-native Loft route is `https://boh.australis.cloud/apps/loft`; `app.jobzcafe.com` is a separate app/repo context and should not be hardcoded into Loft.**
- **`T-0294` tracks the dedicated Loft session layout and CORS hardening follow-up.**
- **Personal Table recording now calls Daily cloud recording for authenticated hosts instead of only flipping a local database flag.**
- **Daily background effects are enabled through the installed Daily client’s video processor where browser/device support exists.**

## What Is Working

- Member login and session hydration work from the standalone Loft app.
- The Lobby loads visible sessions through a service path instead of relying on direct browser reads that can fail under RLS.
- Live reusable tables remain visible even when their original schedule date is in the past.
- Profile/account editing follows the required pattern: full-height side drawer on desktop and bottom sheet on mobile.
- Session join uses `loft-join-token` for session/member validation and Daily token creation.
- Session status and participant roles no longer depend on direct browser REST reads that were returning `403`.
- Raised-hand calls no longer fail because of the old hardcoded `app.jobzcafe.com` CORS response.
- Loft Edge Function CORS is driven by `LOFT_ALLOWED_ORIGINS` with no silent fallback origin.
- Localhost and the BOH origins are documented as the expected Loft validation origins; `/apps/loft` is the explicit application route.
- Desktop participant cards are centered and can use multiple full rows before scrolling.
- Laptop-height layouts preserve one participant row with hidden horizontal scrolling and space for the transport bar below.
- Participant rail scrolling remains available without showing a visible browser scrollbar.
- Participant-card background tint and edge overlay have been removed from Loft sessions.
- Personal Table participant tint has been removed to match the cleaner session treatment.
- Listener cards no longer show unnecessary mic/video controls when the listener cannot use them.
- The host stage card has been refined toward participant-card proportions and no longer carries a duplicate host badge at the top.
- Host name readability has been improved by separating the name from role/control rows.
- Personal Table guest links use the table invite code rather than the host/member profile slug.
- Guests can request access and remain in a waiting state until the host opens the table.
- Guest waiting polling is reduced before the host opens the table.
- Host admission controls can dismiss or clear waiting guests through authenticated service paths.
- Personal Table recording uses Daily cloud recording where available and validates host ownership.
- Recording failures surface safe host-facing messages.
- Daily video processor support is enabled for session and Personal Table call objects.
- Six built-in JOBZCAFE® Loft background images are wired into the Effects picker.
- Background effects show unsupported-state messaging rather than silently pretending an effect was applied.
- Engineering guardrails are documented in `docs/engineering-guardrails.md`.
- The change history is documented in `docs/loft-change-ledger.md`.

## What Is Not Fully Implemented Yet

- Production deployment has not been performed from this staging pass.
- Full device/browser QA still needs to be completed on local, dev, and registered Loft domains.
- Automated regression coverage is still needed for CORS origin handling, direct RLS-read avoidance, laptop-height layouts, hidden horizontal scrolling, participant tint removal, and role-based listener controls.
- Background effects still need cross-device validation, especially iOS Safari, mobile Chrome, and smaller browser windows.
- Settings preview still needs final confirmation that it uses the same processed Daily track as the live participant card.
- Screen sharing still needs a second-user validation pass across host and promoted participant roles.
- Chat still needs an enterprise-grade review for persistence expectations, unread states, errors, timestamps, accessibility, and mobile drawer behavior.
- Built-in background image assets need final compression/thumbnail review before release allocation.
- Vite still reports the existing large chunk warning and the `AnimatedBackgroundBlobs` dynamic/static import warning.

## Current Test Account State - 2026-05-06

`boshea@jobzcafe.com`:

- Logged in locally as host/superadmin during the latest Loft staging pass.
- Used to validate the live session at `http://localhost:8081/#/room/86867e85-2aea-4957-a5e4-6153ad43a203`.
- Expected tester path: sign in, open Lobby, join a live session, verify host stage and participant rail, open Personal Table, admit guest, test recording, and review background effects.

## Edge Functions

| Function | Status | Project | Purpose | Notes |
| --- | --- | --- | --- | --- |
| `loft-join-token` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Authenticated session join and Daily token creation. | Now carries the session status needed by the frontend and supports host recording capability. |
| `loft-get-room-roles` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Authenticated role lookup for a Loft session. | Keeps role reads out of direct browser table access. |
| `loft-list-hand-raises` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Raised-hand list for sessions. | Uses shared explicit CORS handling. |
| `loft-current-profile` | Source created | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Authenticated profile hydration. | Avoids frontend assumptions about direct profile table access. |
| `loft-list-rooms` | Source created | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Lobby session listing. | Avoids direct browser reads from session listing tables/views. |
| `loft-get-personal-room-by-slug` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Public-safe Personal Table invite lookup. | Public-safe function; returns minimum safe table-open metadata. |
| `loft-request-personal-room-access` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Public-safe guest access request. | Public-safe function; guests can request access before login. |
| `loft-toggle-recording` | Source updated | `jobzcafe-dev` / `jmjrgthqnrebzflythvj` | Host recording start/stop. | Authenticated host-only Daily cloud recording path. |

## Environment Configuration

Required frontend variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_API_BASE_URL`

Required Edge Function configuration:

- `LOFT_ALLOWED_ORIGINS`
- Supabase URL/key/secret values for the target environment
- Daily API configuration for session and recording functions

Expected dev `LOFT_ALLOWED_ORIGINS` values:

- `http://localhost:8081`
- `http://127.0.0.1:8081`
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://boh.australis.cloud`
- `https://boh.jobzcafe.com`

Do not hardcode `app.jobzcafe.com` in Loft. That is a separate app/repo context.

## Staging Readiness Checks

- Confirm the frontend deployment is built from the latest `codex-staging` Loft commit.
- Confirm Edge Function secrets exist in JOBZCAFE-dev without printing values.
- Confirm `LOFT_ALLOWED_ORIGINS` is set exactly for the intended local/dev/registered origins.
- Deploy changed Loft Edge Functions to JOBZCAFE-dev.
- Smoke test:
  - member login
  - Lobby session listing
  - live session join
  - host stage card
  - desktop participant grid
  - laptop-height participant rail and transport bar
  - hidden horizontal scroll behavior
  - Personal Table invite request and host admission
  - Daily recording start/stop
  - raised hands
  - chat
  - background blur/image/off states
  - screen share from browser native picker

## BOH Counter Tracking

Existing Loft tickets updated/commented:

- `T-0113` Improve Loft connection stability in meetings
- `T-0114` Standardize Loft error handling states
- `T-0117` Improve Loft automated test coverage
- `T-0118` Optimize Loft bundle size and frontend performance
- `T-0119` Fix Loft Safari and browser compatibility issues

New ticket:

- `T-0294` Finalize Loft session layout and CORS hardening

Verification from BOH showed the 2026-05-06 comments on the existing Loft tickets. `T-0294` was created directly, so it does not need the existing-ticket comment marker to prove creation.
