insert into public.scheduling_meeting_types (
  staff_id,
  name,
  slug,
  description,
  duration_minutes,
  buffer_minutes_after,
  is_active
)
select
  sp.id,
  'Investor Call',
  'investor-call',
  'A 25-minute investor conversation',
  25,
  5,
  true
from public.scheduling_staff_profiles sp
where lower(sp.email) in ('alanum@jobzcafe.com', 'boshea@jobzcafe.com')
  and not exists (
    select 1
    from public.scheduling_meeting_types mt
    where mt.staff_id = sp.id
      and mt.slug = 'investor-call'
  );
