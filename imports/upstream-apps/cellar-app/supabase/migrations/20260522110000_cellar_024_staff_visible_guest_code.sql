-- CELLAR shared guest code is intentionally staff-visible for the 14-day guest cycle.

alter table public.cellar_guest_access_codes
  add column if not exists cellar_display_code text;

comment on column public.cellar_guest_access_codes.cellar_display_code is
  'CELLAR staff-visible shared guest code for the active 14-day guest cycle. Not used for verified investor auth.';

comment on table public.cellar_guest_access_codes is
  'CELLAR shared investor guest access codes. Hash is used for verification; cellar_display_code is staff-visible for current shared guest-code operations.';

drop function if exists public.cellar_current_guest_access_code_summary();

create or replace function public.cellar_current_guest_access_code_summary()
returns table(
  guest_access_code_id uuid,
  status text,
  issued_at timestamptz,
  expires_at timestamptz,
  reset_at timestamptz,
  days_remaining integer,
  cellar_guest_code text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cellar_expire_guest_access_codes();

  return query
  select
    cgac.id,
    cgac.status,
    cgac.issued_at,
    cgac.expires_at,
    cgac.reset_at,
    greatest(ceil(extract(epoch from (cgac.expires_at - now())) / 86400)::integer, 0),
    cgac.cellar_display_code
  from public.cellar_guest_access_codes as cgac
  where cgac.status = 'active'
  order by cgac.issued_at desc
  limit 1;
end;
$$;

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

comment on function public.cellar_current_guest_access_code_summary() is
  'CELLAR service helper: returns active shared guest-code metadata and staff-visible current code.';

comment on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) is
  'CELLAR service helper: replaces the active shared guest code with a staff-visible 14-day code.';

revoke execute on function public.cellar_current_guest_access_code_summary() from public, anon, authenticated;
revoke execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) from public, anon, authenticated;

grant execute on function public.cellar_current_guest_access_code_summary() to service_role;
grant execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb, text) to service_role;
