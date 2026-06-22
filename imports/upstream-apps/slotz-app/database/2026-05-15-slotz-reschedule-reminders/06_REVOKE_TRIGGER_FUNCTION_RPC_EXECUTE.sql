-- Keep trigger functions SECURITY DEFINER, but prevent direct RPC execution.
-- Safe to run more than once.

revoke all on function public.enqueue_booking_reminder_jobs() from public;
revoke execute on function public.enqueue_booking_reminder_jobs() from anon;
revoke execute on function public.enqueue_booking_reminder_jobs() from authenticated;

revoke all on function public.enqueue_booking_change_jobs() from public;
revoke execute on function public.enqueue_booking_change_jobs() from anon;
revoke execute on function public.enqueue_booking_change_jobs() from authenticated;
