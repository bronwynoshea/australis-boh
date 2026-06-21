select
  ct.ticket_number,
  ct.subject,
  s.key as status_key,
  p.key as priority_key,
  brv.version_label,
  brv.version_number,
  brv.environment,
  brv.release_tier,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = ct.id
      and c.body like '%[[codex_loft_20260517_personal_tables_admin_done]]%'
  ) as has_done_comment,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = ct.id
      and c.body like '%[[codex_loft_20260517_personal_tables_admin_release_allocated]]%'
  ) as has_release_comment
from public.counter_ticket ct
left join public.counter_ticket_status s on s.id = ct.status_id
left join public.counter_ticket_priority p on p.id = ct.priority_id
left join public.boh_release_version brv on brv.id = ct.release_version_id
where ct.ticket_number = 'T-0298';
