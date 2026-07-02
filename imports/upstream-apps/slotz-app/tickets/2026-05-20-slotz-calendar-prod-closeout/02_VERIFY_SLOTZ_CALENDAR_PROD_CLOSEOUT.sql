select
  t.ticket_number,
  t.subject,
  s.key as status_key,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body ilike any (array[
        '%[[slotz_calendar_prod_closeout_20260520]]%',
        '%[[slotz_oauth_environment_closeout_20260520]]%',
        '%[[slotz_calendar_smoke_closeout_20260520]]%',
        '%[[slotz_reminder_queue_next_20260520]]%'
      ])
  ) as closeout_comment_present
from public.counter_ticket t
left join public.counter_ticket_status s on s.id = t.status_id
where t.ticket_number in ('T-0297', 'T-2099', 'T-2100', 'T-2101')
order by (regexp_replace(t.ticket_number, '^T-', ''))::int;
