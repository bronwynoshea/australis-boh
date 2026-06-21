select
  ct.ticket_number,
  ct.subject,
  s.key as status_key,
  p.key as priority_key,
  ct.app,
  ct.app_context,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = ct.id
      and c.body like '%[[codex_loft_20260508_personal_table_invite_done]]%'
  ) as has_20260508_completion_comment
from public.counter_ticket ct
left join public.counter_ticket_status s on s.id = ct.status_id
left join public.counter_ticket_priority p on p.id = ct.priority_id
where ct.ticket_number = 'T-0295';
