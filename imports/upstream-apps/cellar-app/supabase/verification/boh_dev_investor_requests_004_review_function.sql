-- Run in BOH-DEV fourth. Chunk 4 of 4: compact staff review helper.
create or replace function public.cellar_review_investor_request(
  p_investor_profile_id uuid,
  p_action text,
  p_boh_user_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(investor_profile_id uuid, investor_access_id uuid, access_status text, profile_status text, pipeline_status text)
language plpgsql security definer set search_path = public as $$
declare
  cellar_action text := lower(trim(coalesce(p_action, '')));
  cellar_profile record;
  cellar_access_status text;
  cellar_profile_status text;
  cellar_pipeline_status text;
begin
  if p_investor_profile_id is null then raise exception 'CELLAR_INVESTOR_PROFILE_REQUIRED' using errcode = '22023'; end if;
  if p_boh_user_id is null or trim(p_boh_user_id) = '' then raise exception 'CELLAR_BOH_USER_REQUIRED' using errcode = '22023'; end if;
  if cellar_action not in ('approve', 'need_more_info', 'decline') then raise exception 'CELLAR_REVIEW_ACTION_INVALID' using errcode = '22023'; end if;
  select * into cellar_profile from public.cellar_investor_profiles cip where cip.id = p_investor_profile_id for update;
  if cellar_profile.id is null then raise exception 'CELLAR_INVESTOR_PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;
  if cellar_action = 'approve' then
    cellar_access_status := 'verified'; cellar_profile_status := 'verified'; cellar_pipeline_status := 'new_investor';
  elsif cellar_action = 'need_more_info' then
    cellar_access_status := 'verification_pending'; cellar_profile_status := 'needs_more_info'; cellar_pipeline_status := 'needs_more_info';
  else
    cellar_access_status := 'revoked'; cellar_profile_status := 'rejected'; cellar_pipeline_status := 'declined';
  end if;
  update public.cellar_investor_access cia
  set access_status = cellar_access_status,
      pipeline_status = cellar_pipeline_status,
      verified_at = case when cellar_action = 'approve' then coalesce(cia.verified_at, now()) else cia.verified_at end,
      updated_by_boh_user_id = p_boh_user_id,
      metadata = cia.metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_cellar_review_action', cellar_action, 'last_cellar_reviewed_at', now(), 'last_cellar_reviewed_by_boh_user_id', p_boh_user_id)
  where cia.id = cellar_profile.investor_access_id;
  update public.cellar_investor_profiles cip
  set profile_status = cellar_profile_status,
      reviewed_at = now(),
      reviewed_by_boh_user_id = p_boh_user_id,
      metadata = cip.metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_cellar_review_action', cellar_action, 'last_cellar_reviewed_at', now(), 'last_cellar_reviewed_by_boh_user_id', p_boh_user_id)
  where cip.id = p_investor_profile_id;
  investor_profile_id := p_investor_profile_id;
  investor_access_id := cellar_profile.investor_access_id;
  access_status := cellar_access_status;
  profile_status := cellar_profile_status;
  pipeline_status := cellar_pipeline_status;
  return next;
end;
$$;

comment on function public.cellar_review_investor_request(uuid, text, text, jsonb) is
  'CELLAR service helper: staff review action for pending investor profile requests.';

revoke execute on function public.cellar_review_investor_request(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cellar_review_investor_request(uuid, text, text, jsonb) to service_role;
