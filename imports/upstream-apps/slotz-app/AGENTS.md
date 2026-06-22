# SLOTZ Codex Notes

This repository is the SLOTZ scheduling app. Do not refer to this app as CHATZ in new code, docs, branches, or deployment notes. The current local folder may still be `chatz-app` until Windows file locks allow it to be renamed to `slotz-app`.

## Supabase SQL Workflow

- Supabase SQL Editor has a practical chunk limit for this project. Keep runnable SQL files under 100 lines.
- Split migrations into numbered files plus an `INDEX_DO_NOT_RUN.sql` run-order note.
- Always include a separate verify SQL file for schema, triggers, cron, or policy changes.
- SQL intended for Supabase Dashboard must be SQL-only. Do not paste Markdown into runnable SQL files.

## Manage Booking And RLS

- Public manage links must not rely on direct anon reads from `public.scheduling_bookings`.
- Use an Edge Function/service-role path for manage booking lookup, reschedule, and cancel flows.
- Do not add a silent direct-query fallback for manage booking reads. If the Edge Function fails, surface the failure so RLS/deploy issues are visible.
- Do not add silent fallbacks for production data paths. Missing staff context, missing timezone, failed Edge Function calls, and RLS failures should be visible errors or explicit empty states, not quiet substitutions that hide configuration problems.
- Staff-only Edge Functions must validate auth explicitly from the incoming Bearer token. Do not rely on a Supabase publishable client with `global.headers.Authorization` plus `auth.getUser()` with no token. Extract the token from the request header and call `auth.getUser(token)` against the intended project before resolving the staff profile.
- While manage links use raw booking ids, deploy public manage Edge Functions with JWT verification disabled:
  - `slotz-get-managed-booking`
  - `slotz-get-reschedule-context`
  - `slotz-reschedule-booking`
  - `slotz-cancel-booking`
- This is a temporary compatibility posture until manage links move to signed, expiring tokens.

## Dev To Prod Tracking

- Keep dev and prod Edge Function slugs identical.
- SLOTZ-owned Edge Function slugs must start with `slotz-` so they are distinguishable in shared Supabase projects.
- BOH-dev Supabase project ref for SLOTZ is `lczzeiqmnegyjrwtgmsj`.
- The project ref `gsidwiptqkyciexqdbyw` is BOH/prod and was used accidentally during early testing; do not treat those deployments as the dev source of truth.
- Keep environment-specific values explicit and isolated. For cron SQL, the only expected environment-specific value is `edge_functions_base_url`.
- Production promotion should happen only after dev smoke tests pass:
  - manage link loads a booking
  - reschedule updates the same booking record
  - Outlook event PATCH succeeds
  - cancel updates booking status and deletes Outlook event where applicable
  - reminder job queue rows are created/updated as expected
  - Supabase linter is clean

## Guest-Facing Tone And Color

- Manage and booking pages should feel calm, personal, and service-oriented.
- Prefer headings like `Your Session` or `Session Details` over harsher admin phrasing such as `Manage Your Session`.
- Use medium-bold typography on guest pages. Avoid extra-heavy headline/card text unless it is a true hero or final status.
- Use the SLOTZ purple as the primary action color.
- Use visibly plum SLOTZ theme color for guest-facing headings and primary text. Do not use colors that read as black for guest headings such as `Your Session`, `Reschedule`, or `Your Info`.
- Form controls on guest-facing pages must be styled to the SLOTZ theme. Do not ship browser/Windows-default select, input, textarea, or button chrome when a themed control is visible to guests.
- Guest-facing add-to-calendar actions must be reminder-only and must not imply that moving a Google, Outlook, or Apple calendar copy reschedules the SLOTZ booking. Calendar reminder details should point users back to the SLOTZ manage link for changes. Reschedule and cancel actions must route through SLOTZ/manage links so staff and calendar sync stay authoritative.
- Cancellation should be visually quiet until the final confirmation step:
  - idle cancel buttons use soft rose/neutral styling
  - strong red is reserved for confirmed canceled states, errors, or the destructive confirmation action
- Prefer labels like `Choose a New Time` and `Cancel Session` for guest-facing actions.
- Guest-facing booking/manage pages must show times in the guest/user timezone only. Do not show staff local timezone or bracketed staff time on user pages.

## Deferred Polish

- Keep the later enterprise polish plan in `docs/ENTERPRISE_POLISH_PLAN.md`.
- Do targeted trust/polish fixes during workflow testing, but save the full visual system pass until reschedule, cancel, Outlook sync, reminder queues, and linter checks are proven in BOH-dev.
