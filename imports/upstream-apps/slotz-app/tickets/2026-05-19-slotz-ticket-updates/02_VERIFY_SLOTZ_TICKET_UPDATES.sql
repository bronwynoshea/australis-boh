select
  t.ticket_number,
  s.key as status_key,
  exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body like any (array[
        '%[[slotz_polish_progress_20260519_commit_0405608]]%',
        '%[[slotz_rename_progress_20260519]]%',
        '%[[codex_reusable_skills_plan_20260519]]%'
      ])
  ) as has_20260519_update
from public.counter_ticket t
left join public.counter_ticket_status s on s.id = t.status_id
where t.ticket_number in ('T-0297', 'T-0285', 'T-0293')
order by t.ticket_number;
