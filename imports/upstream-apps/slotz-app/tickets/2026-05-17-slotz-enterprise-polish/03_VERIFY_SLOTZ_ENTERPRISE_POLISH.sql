select
  ct.ticket_number,
  ct.subject,
  s.key as status_key,
  p.key as priority_key,
  ct.app_context,
  ct.created_at
from public.counter_ticket ct
left join public.counter_ticket_status s on s.id = ct.status_id
left join public.counter_ticket_priority p on p.id = ct.priority_id
where ct.ticket_number in ('T-0058', 'T-0297')
order by ct.ticket_number;

select
  ct.ticket_number,
  count(c.id) filter (
    where c.body like '%[[slotz_outlook_tested_20260517]]%'
  ) as slotz_outlook_comment_count
from public.counter_ticket ct
left join public.counter_ticket_comment c on c.ticket_id = ct.id
where ct.ticket_number = 'T-0058'
group by ct.ticket_number;
