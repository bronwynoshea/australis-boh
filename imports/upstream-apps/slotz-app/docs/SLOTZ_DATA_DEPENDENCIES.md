# SLOTZ Data Dependencies

This is the living dependency map for SLOTZ database objects and Edge Functions.
Update this file whenever a change adds, removes, renames, or changes the expected shape of a table, view, trigger, policy, or Edge Function.

Purpose:
- Keep the current working schema documented while SLOTZ is polished.
- Make a later dev-only table rename/prefix migration safer.
- Avoid silent fallbacks by showing which production data paths must fail visibly.

## Current Position

SLOTZ currently uses shared scheduling and Outlook table names such as `scheduling_bookings` and `outlook_calendar_sync`.

Edge Functions are already SLOTZ-prefixed with `slotz-` and should stay that way. Table names are not being renamed during the enterprise polish pass. A table rename should be a dedicated database-hardening project after the full app is working and production is stable.

## Current Tables

| Current table | Role | Proposed future name |
| --- | --- | --- |
| `scheduling_staff_profiles` | Staff identity, public slug, timezone, meeting link, staff settings | `slotz_staff_profiles` |
| `scheduling_meeting_types` | Meeting types, duration, labels, booking metadata, legend colors | `slotz_meeting_types` |
| `scheduling_bookings` | SLOTZ bookings, guest details, status, reschedule/cancel state, external calendar ids | `slotz_bookings` |
| `scheduling_availability_rules` | Staff availability rules used by booking/reschedule context | `slotz_availability_rules` |
| `scheduling_blackout_dates` | Staff unavailable dates and holiday/date blocks | `slotz_blackout_dates` |
| `outlook_calendar_sync` | Outlook connection/sync configuration and sync health | `slotz_calendar_sync_accounts` or `slotz_outlook_calendar_sync` |
| `outlook_oauth_tokens` | Outlook OAuth tokens for connected staff accounts | `slotz_outlook_oauth_tokens` |
| `google_calendar_sync` | Google Calendar connection/sync configuration and sync health | `slotz_calendar_sync_accounts` |
| `google_oauth_tokens` | Google OAuth tokens for connected staff accounts | `slotz_google_oauth_tokens` |
| `outlook_synced_events` | External calendar availability events shown alongside SLOTZ bookings. Provider columns are added by `database/google-calendar-integration`. | `slotz_external_calendar_events` |
| `patron_person` | Patron CRM person record upserted from confirmed SLOTZ booking guests by email | Keep shared Patron CRM name |
| `vault.decrypted_secrets` | Supabase Vault access used by selected Edge Functions | Keep platform-owned name |

## Frontend Consumers

Core database access is centralized in `src/services/supabaseDb.ts`. Prefer adding table access there unless a page has a clear reason to query directly.

Direct table consumers:
- `src/services/supabaseDb.ts`
  - `scheduling_staff_profiles`
  - `scheduling_bookings`
  - `scheduling_meeting_types`
  - `scheduling_availability_rules`
  - `scheduling_blackout_dates`
  - `outlook_calendar_sync`
  - `outlook_oauth_tokens`
  - `google_calendar_sync`
  - `google_oauth_tokens`
  - `outlook_synced_events`
- `src/hooks/useAuth.ts`
  - `scheduling_staff_profiles`
- `src/App.tsx`
  - `scheduling_staff_profiles`
  - `slotz-calendar-sync`
  - `slotz-outlook-callback`
- `src/pages/HomePage.tsx`
  - `scheduling_staff_profiles`
- `src/pages/BookingPage.tsx`
  - creates bookings through `supabaseDb.addBooking`
  - public booking payload currently uses `guest_notes`
- `src/components/ManualBookingModal.tsx`
  - creates bookings through `supabaseDb.addBooking`
  - manual booking payload must match public booking payload shape, including `guest_notes`
  - calls `slotz-calendar-sync` before showing manual availability when Outlook sync is enabled
- `src/components/GlobalSettingsEditor.tsx`
  - `scheduling_staff_profiles`
- `src/components/IntegrationsView.tsx`
  - `scheduling_staff_profiles`
  - `outlook_oauth_tokens`
  - `google_oauth_tokens`
  - `google_calendar_sync`
  - `slotz-outlook-connect`
  - `slotz-google-connect`
  - `slotz-calendar-sync`

## Active Edge Functions

Keep these function slugs identical between dev and prod.

| Function | Main tables touched | Notes |
| --- | --- | --- |
| `slotz-calendar-sync` | `outlook_calendar_sync`, `outlook_oauth_tokens`, `google_calendar_sync`, `google_oauth_tokens`, `scheduling_bookings`, `outlook_synced_events`, `scheduling_staff_profiles` | Pulls Outlook and Google Calendar events into local external availability events. Outlook remains the established path; Google requires the SQL and secrets listed below. |
| `slotz-outlook-connect` | `scheduling_staff_profiles` | Starts OAuth flow. |
| `slotz-outlook-callback` | `outlook_oauth_tokens`, `outlook_calendar_sync`, `vault.decrypted_secrets` | Saves tokens and sync config. |
| `slotz-google-connect` | `scheduling_staff_profiles` | Starts Google OAuth flow. Requires `SLOTZ_GOOGLE_CLIENT_ID` and `SLOTZ_GOOGLE_REDIRECT_URI`. |
| `slotz-google-callback` | `google_oauth_tokens`, `google_calendar_sync`, `vault.decrypted_secrets` | Saves Google tokens and sync config. Requires `SLOTZ_GOOGLE_CLIENT_SECRET`. |
| `slotz-outlook-webhook` | `scheduling_bookings`, `outlook_synced_events` | Handles Outlook webhook updates. |
| `slotz-create-outlook-event` | `scheduling_bookings`, `outlook_calendar_sync`, `outlook_oauth_tokens`, `vault.decrypted_secrets` | Creates Outlook calendar events for SLOTZ bookings. |
| `slotz-get-managed-booking` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Public manage lookup. No direct anon fallback. |
| `slotz-get-reschedule-context` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles`, `scheduling_availability_rules`, `scheduling_blackout_dates`, `outlook_synced_events` | Public reschedule context. |
| `slotz-reschedule-booking` | `scheduling_bookings`, `outlook_oauth_tokens`, `outlook_synced_events`, `vault.decrypted_secrets` | Updates booking and Outlook event where applicable. |
| `slotz-cancel-booking` | `scheduling_bookings`, `outlook_oauth_tokens`, `outlook_synced_events`, `vault.decrypted_secrets` | Cancels booking and deletes/updates Outlook event where applicable. |
| `slotz-send-booking-confirmation` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles`, `patron_person` | Trigger-driven notification and Patron CRM upsert path. Manual Booking should not make an extra direct success-blocking call after insert. |
| `slotz-send-staff-notification` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Staff notification. |
| `slotz-send-cancellation-notice` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Cancellation email/notice. |
| `slotz-send-rescheduling-notice` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Reschedule email/notice. |
| `slotz-send-daily-staff-reminders` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Staff reminders. |
| `slotz-send-daily-guest-reminders` | `scheduling_bookings`, `scheduling_meeting_types`, `scheduling_staff_profiles` | Guest reminders. |

## Known Shape Notes

- `scheduling_bookings.guest_notes` is used by the public booking path and Manual Booking for guest-entered notes.
- Some UI still reads `agenda_notes` for display compatibility. Confirm the real dev/prod schema before any cleanup.
- `scheduling_bookings.external_event_id` and `scheduling_bookings.outlook_event_id` are both read by calendar sync/cancel/reschedule paths.
- `outlook_synced_events` represents external availability context for Outlook and Google. These should display as External Booking in SLOTZ UI and should not be treated as SLOTZ bookings in Upcoming/History.
- Google Calendar setup is additive until tested live. Run `database/google-calendar-integration` SQL in order, deploy `slotz-google-connect`, `slotz-google-callback`, and `slotz-calendar-sync`, then add Supabase secrets:
  - `SLOTZ_GOOGLE_CLIENT_ID`
  - `SLOTZ_GOOGLE_CLIENT_SECRET`
  - `SLOTZ_GOOGLE_REDIRECT_URI`
- Manual Booking is allowed to book outside public availability, but must still show SLOTZ and External Booking conflicts clearly.
- Confirmed booking inserts should fire `trigger_send_booking_confirmation`, which calls `slotz-send-booking-confirmation` to upsert the guest into `patron_person` by normalized email and send both guest and staff confirmation emails.

## Deferred Table Prefix Migration

Target timing:
- After SLOTZ workflows are working end to end.
- After production is stable enough that dev can be used for a full rename rehearsal.
- Before any broader multi-app shared Supabase cleanup.

Recommended migration approach:
1. Freeze a dependency snapshot from this document.
2. Create a dev-only migration branch.
3. Rename tables or create new `slotz_*` tables.
4. Add compatibility views for old names during transition where safe.
5. Update RLS policies, triggers, trigger functions, cron SQL, Edge Functions, and frontend queries.
6. Refresh generated types if type generation is in use.
7. Run full dev smoke tests before considering prod migration.

Required smoke tests:
- Staff login loads dashboard.
- Staff profile resolves without fallback.
- Public booking creates a booking.
- Public booking creates or updates a `patron_person` row for the guest email.
- Public booking sends confirmation emails to the guest and staff email.
- Manual Booking creates a booking.
- Booking appears in calendar and Upcoming.
- Outlook sync pulls external events.
- Manual Booking blocks/marks conflicts from SLOTZ and external events.
- Manage link loads through Edge Function.
- Reschedule updates the same booking and patches Outlook where applicable.
- Cancel updates booking status and deletes/updates Outlook where applicable.
- Reminder jobs can query expected booking rows.
- Supabase linter is clean.

## Update Checklist

When changing data access, update this doc if any answer changes:
- Did a table/view/function name change?
- Did a payload field change?
- Did a direct frontend table query get added?
- Did an Edge Function start reading/writing another table?
- Did a trigger or RLS policy start depending on a new field?
- Does a smoke test need to be added for a new production data path?
