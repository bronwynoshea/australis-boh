SLOTZ booking reschedule and reminder workflow SQL prepared on 2026-05-15.

Run each file separately in Supabase SQL Editor.
Each runnable file is below the dashboard chunk limit.

Run order:

1. 01_BOOKING_AUDIT_AND_QUEUE_TABLES.sql
2. 02_ENQUEUE_BOOKING_CREATED_REMINDERS.sql
3. 03_ENQUEUE_BOOKING_CHANGE_REMINDERS.sql
4. 04_FIX_DAILY_REMINDER_CRONS.sql
5. 05_VERIFY_RESCHEDULE_REMINDERS.sql
6. 06_REVOKE_TRIGGER_FUNCTION_RPC_EXECUTE.sql
7. 07_REMINDER_QUEUE_RLS_POLICIES.sql
8. 05_VERIFY_RESCHEDULE_REMINDERS.sql

Dev/prod note:

- Run the migration in dev first.
- BOH-dev Supabase project ref for SLOTZ is lczzeiqmnegyjrwtgmsj.
- BOH/prod project ref gsidwiptqkyciexqdbyw was used accidentally during early testing; do not promote from that deploy.
- Before running in prod, edit only edge_functions_base_url in 04_FIX_DAILY_REMINDER_CRONS.sql.
- Keep the Edge Function slugs identical in both environments:
  slotz-get-managed-booking
  slotz-reschedule-booking
  slotz-cancel-booking
  slotz-send-daily-guest-reminders
  slotz-send-daily-staff-reminders
