select
  lower(email) as email,
  display_name,
  personal_room_slug,
  personal_room_public,
  can_use_personal_room,
  can_host_loft,
  personal_room_id::text
from public.profile
where lower(email) in ('boshea@jobzcafe.com', 'admin@australis.cloud', 'hello@australis.cloud')
   or personal_room_slug in ('boshea', 'bronwyn', 'bron-oshea')
order by lower(email), personal_room_slug;
