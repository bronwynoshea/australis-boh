# SLOTZ User Testing Guide

Last updated: 2026-05-19

This is a lightweight walkthrough for testers. It focuses on whether SLOTZ feels clear, reliable, and ready to use for booking and managing sessions.

## Test URL

Production URL: `https://slotz.jobzcafe.com`

Use the production URL unless you are given a separate dev/staging link.

## Test Accounts

Use your own assigned staff login and a guest test email you can access.

If you create extra test bookings, use clearly fake names such as `SLOTZ Test Guest` so they are easy to find and clean up.

## Quick Feedback Format

For each issue, please capture:

- What you were trying to do
- What happened
- What you expected instead
- Browser/device used
- Screenshot if possible
- Approximate time of the test

## Main Smoke Test

Goal: confirm a guest can book a session and the staff user can see it.

1. Open `https://slotz.jobzcafe.com`.
2. Open your own public booking link.
3. Choose a meeting type.
4. Pick an available date and time.
5. Enter the supplied guest test details.
6. Complete the booking.
7. Confirm the booking confirmation screen appears.
8. Check that the staff calendar shows the new booking.

What to look for:

- Is it obvious which meeting type and time are being selected?
- Are times shown clearly in the user's timezone?
- Does the booking confirmation feel calm and complete?
- Does the booking appear on the staff calendar without confusion?

## Guest Manage Link Flow

Goal: confirm guests can manage a booking without staff help.

1. Open the manage link from a booking confirmation email, or use a manage link from one of your own test bookings.
2. Confirm the session details load.
3. Use `Choose a New Time`.
4. Select a different available time.
5. Confirm the change.
6. Return to the manage page and confirm the new time is shown.

What to look for:

- Does the page feel guest-friendly rather than administrative?
- Does rescheduling clearly update the same booking?
- Does the guest understand that SLOTZ is the source of truth for changes?

## Guest Cancellation Flow

Goal: confirm a guest can cancel safely and deliberately.

1. Open a test booking manage link.
2. Click `Cancel Session`.
3. Review the confirmation step.
4. Add a short cancellation reason if requested.
5. Confirm cancellation.
6. Check that the final state clearly says the session is canceled.

What to look for:

- Is cancellation quiet until the final destructive step?
- Is the final canceled state unmistakable?
- Does the staff calendar reflect the cancellation?

## Staff Calendar Flow

Goal: confirm the staff calendar is usable for day-to-day scheduling.

1. Sign in as the staff user.
2. Open the staff calendar.
3. Switch between day, week, and month views if available.
4. Open an existing booking.
5. Review guest details, meeting type, time, and status.
6. Create a manual test booking if that option is available.

What to look for:

- Can staff quickly understand the day's schedule?
- Are upcoming, past, canceled, and rescheduled bookings visually clear?
- Does the booking detail panel show enough context?
- Are manual bookings easy to create without double-booking?

## Reminder Email Test

Goal: confirm reminder jobs and reminder emails are working.

1. Create a test booking for the next reminder window you have been asked to validate.
2. Use a guest test email you can access.
3. Confirm the booking appears on the staff calendar.
4. Wait for the scheduled reminder job window.
5. Check the guest inbox for reminder email delivery.
6. Check the staff inbox for staff reminder delivery if enabled.

What to look for:

- Did the reminder arrive at the expected time?
- Was the email content accurate?
- Did it link back to the SLOTZ manage flow for changes?
- Did it avoid implying that calendar edits reschedule the SLOTZ booking?

## Calendar Integrations

Goal: confirm Outlook and Google Calendar connections work after setup.

1. Sign in as the staff user.
2. Open Settings.
3. Open Integrations.
4. Check Outlook status.
5. Click Connect or Reconnect Outlook if needed.
6. Complete the Microsoft consent flow.
7. Return to SLOTZ and confirm the integration shows connected.
8. Repeat the same check for Google Calendar.
9. Run Sync Now if available.
10. Confirm external calendar events appear as blocked time in SLOTZ.

What to look for:

- Does the integration status make sense before and after connecting?
- Does the OAuth flow return to SLOTZ cleanly?
- Are external events visible enough to prevent double-booking?
- Does SLOTZ remain the source of truth for SLOTZ bookings?

## Public Booking Experience

Goal: confirm the booking page feels polished for guests.

1. Open the public booking page on desktop.
2. Open the same page on mobile.
3. Review meeting type, duration, availability, form fields, and confirmation.
4. Try light and dark mode if available.

What to look for:

- Does the page feel personal and service-oriented?
- Are controls styled consistently?
- Is the layout readable on mobile?
- Is there any admin/internal language visible to guests?

## Accessibility And Usability

Please note any issues with:

- Small text
- Low contrast
- Buttons that are hard to tap
- Forms that are unclear
- Loading states that feel stuck
- Error messages that do not explain what to do next

## Suggested Test Matrix

Run at least one pass on:

- Chrome desktop
- Safari or Chrome mobile
- Light mode
- Dark mode
- Public guest booking
- Staff calendar
- Manage/reschedule/cancel
- Outlook integration
- Google integration
- Reminder email delivery

## Sign-Off Questions

Before sign-off, answer:

- Could a guest book without help?
- Could a guest reschedule or cancel without help?
- Could staff understand and manage the calendar?
- Did reminder emails arrive and make sense?
- Did Outlook and Google integrations connect and sync?
- Did anything feel confusing, broken, or unfinished?
