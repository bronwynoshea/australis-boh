select
  t.ticket_number,
  t.subject,
  s.key as status_key,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body ilike any (array[
        '%[[slotz_oauth_auth_closeout_20260524]]%',
        '%[[slotz_calendar_smoke_closeout_20260524]]%',
        '%[[slotz_reminder_delivery_progress_20260524]]%',
        '%[[slotz_staff_booking_reschedule_polish_20260524]]%'
      ])
  ) as smoke_update_comment_present
from public.counter_ticket t
left join public.counter_ticket_status s on s.id = t.status_id
where t.ticket_number in ('T-0297', 'T-0300', 'T-0301', 'T-0302')
order by (regexp_replace(t.ticket_number, '^T-', ''))::int;
