-- CELLAR shared guest code display format: 3 safe characters, dash, 3 safe characters.

create or replace function public.cellar_reset_guest_access_code(
  p_code_hash text,
  p_boh_user_id text,
  p_reset_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_cellar_display_code text default null
)
returns table(
  guest_access_code_id uuid,
  issued_at timestamptz,
  expires_at timestamptz,
  cellar_guest_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_code_id uuid;
  cellar_issued_at timestamptz := now();
  cellar_expires_at timestamptz := cellar_issued_at + interval '14 days';
  cellar_code text := upper(nullif(trim(coalesce(p_cellar_display_code, '')), ''));
begin
  if p_code_hash is null or length(trim(p_code_hash)) < 32 then
    raise exception 'CELLAR_CODE_HASH_REQUIRED' using errcode = '22023';
  end if;

  if cellar_code is null or cellar_code !~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$' then
    raise exception 'CELLAR_DISPLAY_CODE_REQUIRED' using errcode = '22023';
  end if;

  perform public.cellar_expire_guest_access_codes();

  update public.cellar_guest_access_codes
  set
    status = 'expired',
    reset_at = coalesce(reset_at, cellar_issued_at),
    reset_reason = coalesce(reset_reason, 'replaced_by_cellar_reset_guest_access_code'),
    reset_by_boh_user_id = coalesce(reset_by_boh_user_id, p_boh_user_id)
  where status = 'active';

  insert into public.cellar_guest_access_codes (
    code_hash,
    cellar_display_code,
    status,
    issued_at,
    expires_at,
    reset_at,
    reset_reason,
    created_by_boh_user_id,
    reset_by_boh_user_id,
    metadata
  )
  values (
    lower(trim(p_code_hash)),
    cellar_code,
    'active',
    cellar_issued_at,
    cellar_expires_at,
    cellar_issued_at,
    nullif(trim(coalesce(p_reset_reason, '')), ''),
    p_boh_user_id,
    p_boh_user_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('cellar_cycle_days', 14)
  )
  returning id into cellar_code_id;

  guest_access_code_id := cellar_code_id;
  issued_at := cellar_issued_at;
  expires_at := cellar_expires_at;
  cellar_guest_code := cellar_code;
  return next;
end;
$$;

comment on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) is
  'CELLAR service helper: replaces the active shared guest code with a staff-visible XXX-XXX 14-day code.';

revoke execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) to service_role;
