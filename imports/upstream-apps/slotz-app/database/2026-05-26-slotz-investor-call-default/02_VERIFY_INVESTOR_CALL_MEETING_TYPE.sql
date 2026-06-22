select
  sp.email,
  mt.name,
  mt.slug,
  mt.duration_minutes,
  mt.buffer_minutes_after,
  mt.is_active
from public.scheduling_staff_profiles sp
left join public.scheduling_meeting_types mt
  on mt.staff_id = sp.id
 and mt.slug = 'investor-call'
where lower(sp.email) in ('alanum@jobzcafe.com', 'boshea@jobzcafe.com')
order by sp.email;
