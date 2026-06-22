-- CELLAR guest-code verification RPC fix: disambiguate output columns.

create or replace function public.cellar_verify_guest_access_code(
  p_raw_code text,
  p_user_agent text default null,
  p_ip_hash text default null
)
returns table(session_id uuid, guest_access_code_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_code_id uuid;
  cellar_expires_at timestamptz;
  cellar_session_id uuid;
  cellar_session_code_id uuid;
  cellar_session_expires_at timestamptz;
begin
  select cgac.id, cgac.expires_at into cellar_code_id, cellar_expires_at
  from public.cellar_guest_access_codes as cgac
  where cgac.code_hash = public.cellar_sha256_hex(public.cellar_normalize_access_code(p_raw_code))
    and cgac.status = 'active'
    and (cgac.expires_at is null or cgac.expires_at > now())
  limit 1;

  if cellar_code_id is null then
    raise exception 'CELLAR_ACCESS_CODE_INVALID' using errcode = '28000';
  end if;

  insert into public.cellar_investor_sessions (
    guest_access_code_id,
    session_kind,
    last_seen_at,
    expires_at,
    user_agent,
    ip_hash
  )
  values (
    cellar_code_id,
    'guest_code',
    now(),
    coalesce(cellar_expires_at, now() + interval '24 hours'),
    p_user_agent,
    p_ip_hash
  )
  returning id, cellar_investor_sessions.guest_access_code_id, cellar_investor_sessions.expires_at
    into cellar_session_id, cellar_session_code_id, cellar_session_expires_at;

  insert into public.cellar_activity_events (investor_session_id, actor_kind, event_type, metadata)
  values (cellar_session_id, 'guest', 'guest_code_used', jsonb_build_object('source', 'cellar_verify_guest_access_code'));

  session_id := cellar_session_id;
  guest_access_code_id := cellar_session_code_id;
  expires_at := cellar_session_expires_at;
  return next;
end;
$$;

comment on function public.cellar_verify_guest_access_code(text, text, text) is
  'CELLAR RPC for service/Edge-mediated guest-code verification.';

revoke execute on function public.cellar_verify_guest_access_code(text, text, text) from public, anon, authenticated;
grant execute on function public.cellar_verify_guest_access_code(text, text, text) to service_role;
