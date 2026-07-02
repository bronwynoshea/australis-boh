select
  tg.tgname as trigger_name,
  tg.tgenabled as trigger_enabled,
  tg.tgfoid::regproc::text as trigger_function
from pg_trigger tg
where tg.tgrelid = 'public.scheduling_bookings'::regclass
  and tg.tgname = 'trigger_send_booking_confirmation';

select
  proname as function_name,
  has_function_privilege('anon', oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute
from pg_proc
where oid = 'public.slotz_send_booking_confirmation()'::regprocedure;
