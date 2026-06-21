select
  ct.ticket_number,
  ct.subject,
  s.key as status_key,
  p.key as priority_key,
  ct.app,
  ct.app_context,
  rv.version_label,
  rv.version_number,
  rv.environment,
  rv.release_tier,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = ct.id
      and c.body like '%[[codex_loft_20260508_personal_table_invite_release_allocated]]%'
  ) as has_20260508_release_allocation_comment
from public.counter_ticket ct
left join public.counter_ticket_status s on s.id = ct.status_id
left join public.counter_ticket_priority p on p.id = ct.priority_id
left join public.boh_release_version rv on rv.id = ct.release_version_id
where ct.ticket_number = 'T-0295';
