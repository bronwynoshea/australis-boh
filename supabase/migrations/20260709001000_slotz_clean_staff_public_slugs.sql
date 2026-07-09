-- Remove email-derived SLOTZ public booking slugs.
-- Public booking URLs must use person-name slugs, not email addresses.

begin;

update public.scheduling_staff_profiles
set slug = 'australis-admin',
    updated_at = now()
where lower(email) = 'admin@australis.cloud'
  and slug is distinct from 'australis-admin';

update public.scheduling_staff_profiles
set slug = 'asa-lanum',
    updated_at = now()
where lower(email) = 'alanum@jobzcafe.com'
  and slug is distinct from 'asa-lanum';

update public.scheduling_staff_profiles
set slug = 'dave-mccandless',
    updated_at = now()
where lower(email) = 'davemccandless@gmail.com'
  and slug is distinct from 'dave-mccandless';

update public.scheduling_staff_profiles
set slug = 'mary-macedonio',
    updated_at = now()
where lower(email) = 'drmary@empathea.com'
  and slug is distinct from 'mary-macedonio';

update public.scheduling_staff_profiles
set slug = 'john-loomis-2',
    updated_at = now()
where lower(email) = 'jloomis@jobzcafe.com'
  and slug is distinct from 'john-loomis-2';

update public.scheduling_staff_profiles
set slug = 'sydney-wardley',
    updated_at = now()
where lower(email) = 'jobzcafe.ai@gmail.com'
  and slug is distinct from 'sydney-wardley';

update public.scheduling_staff_profiles
set slug = 'walkthrough-demo',
    updated_at = now()
where lower(email) = 'walkthrough-demo@jobzcafe.com'
  and slug is distinct from 'walkthrough-demo';

commit;
