select
  t.ticket_number,
  t.subject,
  s.key as status_key,
  p.key as priority_key,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body like any (array[
        '%[[slotz_boh_promotion_progress_20260520]]%',
        '%[[slotz_calendar_promotion_followup_20260520]]%'
      ])
  ) as has_20260520_comment
from public.counter_ticket t
left join public.counter_ticket_status s on s.id = t.status_id
left join public.counter_ticket_priority p on p.id = t.priority_id
where t.ticket_number in ('T-0297', 'T-0058', 'T-2099', 'T-2100', 'T-2101')
order by (regexp_replace(t.ticket_number, '^T-', ''))::int;
