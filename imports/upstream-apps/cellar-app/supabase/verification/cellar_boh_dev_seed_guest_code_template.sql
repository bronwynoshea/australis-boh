-- CELLAR BOH-DEV seed template for project lczzeiqmnegyjrwtgmsj.
-- Do not paste plaintext access codes into SQL. Compute the SHA-256 hash locally
-- using the same normalization rule: uppercase A-Z/0-9 only, then SHA-256 hex.

select *
from public.cellar_reset_guest_access_code(
  p_code_hash := '<NORMALIZED_CODE_SHA256_HEX>',
  p_boh_user_id := null,
  p_reset_reason := 'boh_dev_seed_current_shared_guest_code',
  p_metadata := jsonb_build_object(
    'source', 'cellar_boh_dev_seed_guest_code_template',
    'project_ref', 'lczzeiqmnegyjrwtgmsj',
    'plaintext_stored', false
  )
);

select *
from public.cellar_current_guest_access_code_summary();
