-- CELLAR RPCs for manual/Edge-mediated access-code verification and activity logging.
create or replace function public.cellar_verify_guest_access_code(p_raw_code text, p_user_agent text default null, p_ip_hash text default null)
returns table(session_id uuid, guest_access_code_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_code_id uuid;
  cellar_expires_at timestamptz;
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

  insert into public.cellar_investor_sessions (guest_access_code_id, session_kind, last_seen_at, expires_at, user_agent, ip_hash)
  values (cellar_code_id, 'guest_code', now(), coalesce(cellar_expires_at, now() + interval '24 hours'), p_user_agent, p_ip_hash)
  returning id, guest_access_code_id, expires_at into session_id, guest_access_code_id, expires_at;

  insert into public.cellar_activity_events (investor_session_id, actor_kind, event_type, metadata)
  values (session_id, 'guest', 'guest_code_used', jsonb_build_object('source', 'cellar_verify_guest_access_code'));

  return next;
end;
$$;

comment on function public.cellar_verify_guest_access_code(text, text, text) is
  'CELLAR RPC for service/Edge-mediated guest-code verification. Never stores plaintext access codes.';

create or replace function public.cellar_log_activity(p_investor_access_id uuid, p_event_type text, p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_event_id uuid;
begin
  if not (public.cellar_is_verified_investor(p_investor_access_id) or public.cellar_staff_can_access_investor(p_investor_access_id)) then
    raise exception 'CELLAR_ACTIVITY_ACCESS_DENIED' using errcode = '28000';
  end if;

  insert into public.cellar_activity_events (investor_access_id, actor_kind, actor_auth_user_id, actor_boh_user_id, event_type, metadata)
  values (p_investor_access_id, case when public.cellar_current_boh_user_id() is null then 'verified_investor' else 'staff' end,
    auth.uid(), public.cellar_current_boh_user_id(), p_event_type, coalesce(p_metadata, '{}'::jsonb))
  returning id into cellar_event_id;
  return cellar_event_id;
end;
$$;
