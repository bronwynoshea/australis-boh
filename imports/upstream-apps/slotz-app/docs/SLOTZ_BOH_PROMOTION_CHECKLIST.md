# SLOTZ BOH Promotion Checklist

Use this checklist to promote SLOTZ from BOH-dev to BOH one step at a time.

Do not run write SQL, deploy Edge Functions, update secrets, or change BOH/prod config unless Bronwyn explicitly approves that step.

## Environment

- Source environment: BOH-dev
- Source Supabase project ref: `lczzeiqmnegyjrwtgmsj`
- Target environment: BOH/prod
- Target Supabase project ref: `gsidwiptqkyciexqdbyw`
- Source branch: `codex-staging`
- Current promoted-code candidate: `b95df36`

## Step 1 - Inventory

- [x] Confirm repo instructions in `AGENTS.md`.
- [x] Confirm branch and latest pushed commit.
- [x] Inventory frontend environment variables.
- [x] Inventory SQL folders that may need promotion.
- [x] Inventory Edge Function folders.
- [x] Inventory required Supabase secrets by key name only.
- [x] Inventory OAuth redirect URLs to confirm.
- [x] Confirm production frontend domain.
- [x] Confirm production Supabase auth site URL and redirect URLs.
- [x] Confirm whether Google Calendar integration should promote now or stay deferred.

Step 1 notes:

- Local `.env.local` is still BOH-dev/local oriented:
  - `VITE_SLOTZ_APP_URL` is `http://localhost:5173`.
  - `VITE_SLOTZ_SUPABASE_PROJECT_ID` is `lczzeiqmnegyjrwtgmsj`.
  - `VITE_SLOTZ_SUPABASE_URL` is present but should be treated as environment-specific.
- Local `supabase/config.toml` is still BOH-dev/local oriented:
  - `project_id` is `lczzeiqmnegyjrwtgmsj`.
  - `site_url` is `http://localhost:5173`.
  - `additional_redirect_urls` are localhost URLs.
- No production frontend domain was found in local docs or config during inventory.
- Production frontend domain confirmed by Bronwyn: `https://slotz.jobzcafe.com`.
- Production Supabase Auth URLs confirmed by Bronwyn:
  - Site URL / main BOH app entry: `https://boh.jobzcafe.com`
  - SLOTZ redirect URLs: `https://slotz.jobzcafe.com`, `https://slotz.jobzcafe.com/*`
- Google Calendar code, SQL, and functions exist. Bronwyn confirmed Google OAuth and sync were tested in BOH-dev, so Google Calendar is included in this BOH/prod promotion scope.

## Step 2 - SQL Plan

- [x] Decide which SQL folders are in this promotion.
- [x] Prepare BOH/prod copy of booking confirmation SQL with prod Edge Function base URL.
- [x] Prepare BOH/prod copy of reminder cron SQL with prod Edge Function base URL.
- [x] Keep each runnable SQL file SQL-only and under the dashboard chunk limit where practical.
- [x] Prepare or identify verify SQL for every promoted schema, trigger, cron, or policy change.
- [x] Review rollback notes before any write SQL.
- [x] Approval gate: Bronwyn approves running BOH/prod SQL.
- [x] Run approved BOH/prod SQL.
- [x] Run BOH/prod verify SQL.

Step 2 notes:

- BOH/prod SQL pack prepared in `database/2026-05-19-slotz-boh-prod-promotion/`.
- Included SQL scope:
  - reschedule audit fields and reminder queue tables
  - booking-created reminder trigger
  - booking-change reminder trigger
  - daily reminder cron repair with BOH/prod Edge Function base URL
  - trigger function execute revokes
  - reminder/email event read policies
  - `scheduling_bookings.cancellation_reason`
  - Google Calendar tables
  - external event provider columns
  - booking confirmation trigger with BOH/prod Edge Function base URL
  - verify files for reminder workflow, cancellation reason, Google schema, and booking confirmation trigger
- Root-level older SQL files are not the promotion source of truth for this run.
- All runnable files in the BOH/prod SQL pack are under 100 lines.
- BOH/prod Edge Function base URL used where needed: `https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1`.
- Bronwyn ran BOH/prod SQL. Pasted verify results confirm:
  - daily guest/staff reminder cron jobs exist, are active, and point to BOH/prod functions
  - `scheduling_bookings.cancellation_reason` exists
  - `outlook_synced_events` has `calendar_provider`, `external_calendar_id`, and `external_event_id`
  - `slotz_send_booking_confirmation` cannot be executed directly by anon or authenticated
- Bronwyn pasted BOH/prod schema context. Schema confirms:
  - `scheduling_bookings` has reschedule audit columns and `cancellation_reason`
  - `scheduling_reminder_jobs` exists
  - `scheduling_email_events` exists
  - `google_oauth_tokens` exists
  - `google_calendar_sync` exists
  - `outlook_synced_events` has external provider columns
- Final pasted BOH/prod trigger verify results confirm:
  - `scheduling_booking_enqueue_reminders` exists as an `AFTER INSERT` trigger on `public.scheduling_bookings`
  - `scheduling_booking_enqueue_change_reminders` exists as an `AFTER UPDATE` trigger on `public.scheduling_bookings`
  - `trigger_send_booking_confirmation` is enabled and points to `slotz_send_booking_confirmation`
- Rollback posture documented after verification:
  - Most promoted schema changes are additive; leave added columns/tables in place unless a production issue requires removal.
  - Reminder trigger rollback would drop or disable `scheduling_booking_enqueue_reminders` and `scheduling_booking_enqueue_change_reminders`.
  - Booking confirmation rollback would drop or disable `trigger_send_booking_confirmation`.
  - Reminder cron rollback would restore or remove `slotz-send-daily-guest-reminders` and `slotz-send-daily-staff-reminders`.
  - RLS policy and function privilege rollback requires deliberate security review before changing access behavior.

## Step 3 - Edge Functions

- [x] Confirm the active SLOTZ function slug list.
- [x] Exclude empty or unused local folders from deployment.
- [x] Confirm required `verify_jwt = false` functions:
  - `slotz-get-managed-booking`
  - `slotz-get-reschedule-context`
  - `slotz-reschedule-booking`
  - `slotz-cancel-booking`
  - `slotz-send-booking-confirmation`
  - `slotz-outlook-connect`
  - `slotz-outlook-callback`
  - `slotz-google-connect`
  - `slotz-google-callback`
- [x] Approval gate: Bronwyn approves BOH/prod Edge Function deploys.
- [x] Deploy approved functions to BOH/prod.
- [x] Verify deployed function slugs and JWT settings.

Step 3 notes:

- Local deploy candidate folders with `index.ts`:
  - `slotz-calendar-sync`
  - `slotz-cancel-booking`
  - `slotz-create-outlook-event`
  - `slotz-get-managed-booking`
  - `slotz-get-reschedule-context`
  - `slotz-google-callback`
  - `slotz-google-connect`
  - `slotz-google-status`
  - `slotz-outlook-callback`
  - `slotz-outlook-connect`
  - `slotz-outlook-webhook`
  - `slotz-reschedule-booking`
  - `slotz-send-booking-confirmation`
  - `slotz-send-cancellation-notice`
  - `slotz-send-daily-guest-reminders`
  - `slotz-send-daily-staff-reminders`
  - `slotz-send-rescheduling-notice`
  - `slotz-send-staff-notification`
- Excluded local folder:
  - `slotz-download-calendar-reminder` has no files and no `index.ts`; do not deploy.
- Local `supabase/config.toml` confirms `verify_jwt = false` for the required public manage/connect/callback/trigger functions listed above.
- All deploy candidate function slugs start with `slotz-`.
- Bronwyn deployed BOH/prod Edge Functions and pasted `supabase functions list --project-ref gsidwiptqkyciexqdbyw` output.
- BOH/prod function list confirms all 18 deploy candidate `slotz-` slugs are active.
- Existing old non-`slotz-` functions remain in BOH/prod and were intentionally not removed during this promotion step.
- One deploy attempt produced an entrypoint path error for `supabase/functions/functions/index.ts`; the later BOH/prod function list confirms the expected SLOTZ slugs are present despite that failed attempt.
- Bronwyn initially verified the required BOH/prod public manage/callback/trigger function JWT settings in Supabase Dashboard.
- Production OAuth testing found `slotz-outlook-connect` returning `401` before function code ran; local config was updated to include `verify_jwt = false` for `slotz-outlook-connect` and `slotz-google-connect` because these functions perform their own staff-session check internally.

## Step 4 - Secrets And Config

- [x] Confirm BOH/prod Supabase secrets exist without printing values.
- [x] Confirm `SLOTZ_APP_URL` is the public production SLOTZ URL, not localhost.
- [x] Confirm `SLOTZ_SUPABASE_URL` points to BOH/prod.
- [x] Confirm `SLOTZ_OUTLOOK_REDIRECT_URI` points to the BOH/prod callback function.
- [x] Confirm Google secrets and redirect URI only if Google Calendar is in scope.
- [x] Confirm Supabase auth site URL and allowed redirect URLs are production-safe.
- [x] Approval gate: Bronwyn approves any BOH/prod secret or config changes.
- [x] Apply approved BOH/prod secret or config changes.

Step 4 notes:

- Required BOH/prod Supabase Edge Function secret names from local function code:
  - `SLOTZ_APP_URL`
  - `SLOTZ_SUPABASE_URL`
  - `SLOTZ_SUPABASE_PUBLISHABLE_KEY`
  - `SLOTZ_SUPABASE_ADMIN_KEY`
  - `SLOTZ_RESEND_API_KEY`
  - `SLOTZ_AZURE_CLIENT_ID`
  - `SLOTZ_AZURE_CLIENT_SECRET`
  - `SLOTZ_AZURE_TENANT_ID`
  - `SLOTZ_OUTLOOK_REDIRECT_URI`
  - `SLOTZ_GOOGLE_CLIENT_ID`
  - `SLOTZ_GOOGLE_CLIENT_SECRET`
  - `SLOTZ_GOOGLE_REDIRECT_URI`
- Expected BOH/prod non-secret URL values:
  - `SLOTZ_APP_URL`: `https://slotz.jobzcafe.com`
  - `SLOTZ_SUPABASE_URL`: `https://gsidwiptqkyciexqdbyw.supabase.co`
  - `SLOTZ_OUTLOOK_REDIRECT_URI`: `https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-outlook-callback`
  - `SLOTZ_GOOGLE_REDIRECT_URI`: `https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-google-callback`
- Production Supabase Auth URLs previously confirmed:
  - Site URL / main BOH app entry: `https://boh.jobzcafe.com`
  - Allowed SLOTZ redirects: `https://slotz.jobzcafe.com`, `https://slotz.jobzcafe.com/*`
- Bronwyn confirmed all required secrets exist in BOH/prod Edge Function secrets.
- Bronwyn confirmed BOH/prod Supabase Auth site URL and redirect URLs are set.
- Bronwyn confirmed Outlook and Google redirect URI values are included in BOH/prod Edge Function secrets/config.
- Bronwyn confirmed `SLOTZ_APP_URL` and `SLOTZ_SUPABASE_URL` are set to the expected BOH/prod values.
- No additional BOH/prod secret or config changes were needed during Step 4 beyond confirming the existing values.

## Step 5 - Frontend Promotion

- [x] Confirm production frontend host and deployment path.
- [x] Configure production Cloudflare/DNS/hosting for `https://slotz.jobzcafe.com`.
- [x] Confirm production frontend env uses BOH/prod Supabase URL and publishable key.
- [x] Build locally.
- [x] Review build warnings.
- [x] Approval gate: Bronwyn approves frontend production deploy.
- [x] Deploy frontend.
- [x] Confirm production app loads without stale local/dev config.

Step 5 notes:

- Cloudflare/frontend hosting is configured for `https://slotz.jobzcafe.com`.
- Step 4 Edge Function/Auth config was verified separately; Step 5 confirms the production frontend domain now resolves and serves the SLOTZ app.
- Local production build command `npm.cmd run build` succeeds.
- Build warning: Vite reports the main JS chunk is larger than 500 kB after minification; this is not blocking for promotion, but code-splitting can be considered later.
- Local build used the local `.env.local`, which is BOH-dev oriented. Do not use the local `dist` as the production artifact unless rebuilt with BOH/prod `VITE_SLOTZ_*` values.
- Expected Cloudflare Pages build settings:
  - Build command: `npm run build`
  - Build output directory: `dist`
  - Production branch: `codex-staging`, unless Bronwyn selects another release branch
  - Custom domain: `https://slotz.jobzcafe.com`
- Required production frontend environment variables:
  - `VITE_SLOTZ_APP_URL`: `https://slotz.jobzcafe.com`
  - `VITE_SLOTZ_SUPABASE_URL`: `https://gsidwiptqkyciexqdbyw.supabase.co`
  - `VITE_SLOTZ_SUPABASE_PROJECT_ID`: `gsidwiptqkyciexqdbyw`
  - `VITE_SLOTZ_SUPABASE_PUBLISHABLE_KEY`: BOH/prod Supabase publishable key
- Bronwyn confirmed Cloudflare production settings were updated.
- Bronwyn completed the GitHub promotion path through `staging` to `main`.
- GitHub compare confirms `main` contains `staging` and `codex-staging` content with no remaining file changes to merge.
- Production URL `https://slotz.jobzcafe.com` opened in Codex preview and returned HTTP 200 from an independent fetch.
- Static production HTML check found no stale `localhost`, `dev-slotz`, BOH-dev `lczzeiqmnegyjrwtgmsj`, or unrelated JobzCafe `dqmzrlpiunoxmlrgluju` references.

## Step 6 - Smoke Tests

Production smoke target:

- Frontend URL: `https://slotz.jobzcafe.com`
- Supabase project ref: `gsidwiptqkyciexqdbyw`
- Edge Function base URL: `https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1`
- Do not record Step 6 checks against BOH-dev URLs, BOH-dev project ref `lczzeiqmnegyjrwtgmsj`, or unrelated JobzCafe project ref `dqmzrlpiunoxmlrgluju`.

Historical dev smoke note, 2026-05-19. This is not the active production target:
  - `https://dev-slotz.jobzcafe.com/` loads the SLOTZ login screen with no console or network errors.
  - `https://dev-slotz.jobzcafe.com/#/bronwyn-oshea/quick-chat` renders the booking shell, but the deployed frontend called unrelated JobzCafe project ref `dqmzrlpiunoxmlrgluju` instead of expected BOH-dev `lczzeiqmnegyjrwtgmsj`.
  - The public booking route fails staff lookup because that deployed Supabase project does not expose `public.scheduling_staff_profiles` in the schema cache.
  - Fix the dev frontend environment before continuing dev smoke tests.

Historical dev smoke note after DNS fix, 2026-05-19. This is not the active production target:
  - `https://dev-slotz.jobzcafe.com/#/bronwyn-oshea/quick-chat` now calls BOH-dev project ref `lczzeiqmnegyjrwtgmsj`.
  - Public booking page loads dates and available times with no console or network errors.
  - Created dev smoke booking `215a16b5-6229-4421-8eae-41fc9a18f3fb` for `slotz-smoke+1779178924011@jobzcafe.com`.
  - Booking insert returned `201` and confirmation page rendered.
  - Manage link `#manage-215a16b5-6229-4421-8eae-41fc9a18f3fb` loaded through Edge Function.
  - Reschedule succeeded from Wednesday, May 20, 2026 at 7:00 AM to Thursday, May 21, 2026 at 7:30 AM.
  - Cancel confirmation modal revealed a layering bug: backdrop intercepted clicks on the confirm button. Local fix prepared in `src/components/ConfirmationModal.tsx`.
  - Direct `slotz-cancel-booking` cleanup call returned `500`. Managed-booking response shows BOH-dev booking shape does not include `cancellation_reason`; local SQL fix prepared in `database/2026-05-19-slotz-cancel-booking-fix/`.
  - Retest cancel after deploying the modal fix and running the cancellation reason SQL in BOH-dev.

Production smoke checklist:

- [ ] Production app loads at `https://slotz.jobzcafe.com`.
- [ ] Production frontend calls BOH/prod Supabase project ref `gsidwiptqkyciexqdbyw`, not BOH-dev.
- [ ] Staff login loads dashboard.
- [ ] Public booking creates a confirmed booking.
- [ ] Booking confirmation email is sent.
- [ ] Guest manage link loads through Edge Function.
- [ ] Reschedule updates the same booking record.
- [ ] Outlook event PATCH succeeds where applicable.
- [ ] Cancel updates booking status.
- [ ] Cancel deletes or updates Outlook event where applicable.
- [ ] Reminder queue rows are created or updated as expected.
- [ ] Calendar sync still behaves as expected.
- [ ] Supabase linter is clean.
- [ ] Edge Function failures surface visibly instead of falling back silently.

## Step 7 - Release Notes

- [ ] Record what was promoted.
- [ ] Record what was verified.
- [ ] Record anything not verified.
- [ ] Record known risks.
- [ ] Record rollback notes.
- [ ] Record follow-up tickets or deferred migrations.
