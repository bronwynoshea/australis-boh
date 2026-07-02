SLOTZ booking reschedule and reminder workflow SQL prepared on 2026-05-15.

Run order:

1. rescheduling_and_reminder_workflows.sql
2. rescheduling_and_reminder_workflows_VERIFY.sql

Dev/prod note:

- Run the migration in dev first.
- Before running in prod, edit only edge_functions_base_url inside rescheduling_and_reminder_workflows.sql.
- Keep the Edge Function slugs identical in both environments:
  slotz-reschedule-booking
  slotz-cancel-booking
  slotz-send-daily-guest-reminders
  slotz-send-daily-staff-reminders
