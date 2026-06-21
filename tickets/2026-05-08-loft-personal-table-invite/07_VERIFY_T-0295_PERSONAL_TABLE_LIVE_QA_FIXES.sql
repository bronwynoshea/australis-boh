select
  ct.ticket_number,
  ct.subject,
  s.key as status_key,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = ct.id
      and c.body like '%[[codex_loft_20260522_personal_table_live_qa_fixes]]%'
  ) as has_live_qa_comment
from public.counter_ticket ct
left join public.counter_ticket_status s on s.id = ct.status_id
where ct.ticket_number = 'T-0295';
