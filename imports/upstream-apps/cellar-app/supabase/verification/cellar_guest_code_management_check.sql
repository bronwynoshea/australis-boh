-- CELLAR BOH-DEV guest-code management verification.
-- Replace the hash below with select public.cellar_sha256_hex(public.cellar_normalize_access_code('<NEW_CODE>'));

select
  public.cellar_current_guest_access_code_summary();

select
  count(*) filter (where status = 'active') as active_guest_codes,
  bool_and(code_hash is not null and code_hash !~ '\s') as hashes_present,
  max(expires_at) as active_expires_at
from public.cellar_guest_access_codes;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'cellar_expire_guest_access_codes',
    'cellar_current_guest_access_code_summary',
    'cellar_reset_guest_access_code',
    'cellar_prepare_guest_code_email'
  )
order by routine_name;
