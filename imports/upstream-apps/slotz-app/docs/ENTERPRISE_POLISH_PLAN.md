# SLOTZ Enterprise Polish Plan

Run this after the core workflow is proven in dev:

- manage link loads reliably from public guest links
- reschedule updates the same booking record
- Outlook event PATCH works for reschedules
- cancel updates booking status and removes/updates Outlook event where applicable
- reminder queue rows are created/updated correctly
- BOH-dev Edge Functions use `slotz-` prefixes
- Supabase linter is clean

Data dependency tracking lives in `docs/SLOTZ_DATA_DEPENDENCIES.md`. Keep it updated when table usage, payload fields, Edge Function dependencies, triggers, or RLS assumptions change. The eventual `slotz_*` table-prefix migration is deferred until SLOTZ is working end to end and can be rehearsed safely in dev.

## Current Pass Tracker

1. Login page polish - Complete.
2. Global visual system - Complete pending final cross-screen QA.
3. App shell/navigation - Complete pending final cross-screen QA.
4. Staff dashboard/agenda - Complete pending final cross-screen QA.
5. Settings screens - Complete pending final cross-screen QA.
6. Booking/public pages - Complete pending dev and prod workflow QA.
7. Outlook/Google integration UX - Complete pending dev workflow QA.
8. Feedback and messaging - Complete.
9. Responsive QA - Complete.
10. Accessibility pass - Complete.
11. Production readiness - Next.

## Polish Scope

1. Typography scale
   - Use medium-bold weights by default.
   - Reserve heavier type for rare status moments only.
   - Keep guest-facing headings calm and personal.

2. Button hierarchy
   - Primary action uses SLOTZ purple.
   - Secondary actions use neutral styling.
   - Cancellation stays soft until final confirmation.

3. Guest vs staff visual language
   - Guest pages should feel calm, simple, and privacy-safe.
   - Staff pages can be denser and more operational.
   - Guest pages must show only the guest/user timezone.

4. Manage and reschedule flow
   - Mobile-first layout.
   - Clear loading, unavailable, success, and error states.
   - No silent production-data fallbacks.

5. Admin visibility
   - Show delivery status for reminders/emails.
   - Show calendar sync status per booking.
   - Surface retry/error state without visual noise.

6. QA
   - Playwright screenshots for desktop and mobile.
   - Check console errors.
   - Check text wrapping and button fit.
   - Confirm no hidden staff timezone or internal environment hints on guest pages.
