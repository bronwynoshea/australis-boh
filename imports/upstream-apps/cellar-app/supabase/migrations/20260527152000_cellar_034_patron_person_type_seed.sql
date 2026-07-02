-- CELLAR invite flows require BOH Patron person type lookup rows.
insert into public.patron_person_type (
  key,
  label,
  description,
  is_internal,
  is_active,
  sort_order
)
values
  (
    'staff_internal',
    'Staff / Internal',
    'JOBZ CAFE staff identity for CRM, support, chat, and person history.',
    true,
    true,
    10
  ),
  (
    'investor',
    'Investor',
    'CELLAR investor or verified investor access contact.',
    false,
    true,
    20
  )
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  is_internal = excluded.is_internal,
  is_active = true,
  sort_order = excluded.sort_order;
