-- Run in BOH-DEV second. Chunk 2 of 4: compact submit helper.
create or replace function public.cellar_submit_investor_profile(
  p_auth_user_id uuid, p_email text, p_first_name text, p_last_name text,
  p_investor_category text, p_title text default null, p_company text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(normalized_email text, is_staff_email boolean, patron_person_id uuid, investor_access_id uuid, investor_profile_id uuid, access_status text, profile_status text)
language plpgsql security definer set search_path = public as $$
declare
  cellar_email text := lower(trim(coalesce(p_email, '')));
  cellar_first_name text := nullif(trim(coalesce(p_first_name, '')), '');
  cellar_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
  cellar_full_name text;
  cellar_category text := lower(trim(coalesce(p_investor_category, '')));
  cellar_patron_person_id uuid;
  cellar_patron_person_type_key text;
  cellar_investor_access_id uuid;
  cellar_investor_profile_id uuid;
begin
  if p_auth_user_id is null then raise exception 'CELLAR_AUTH_USER_REQUIRED' using errcode = '22023'; end if;
  if cellar_email = '' or position('@' in cellar_email) = 0 then raise exception 'CELLAR_INVESTOR_EMAIL_REQUIRED' using errcode = '22023'; end if;
  if cellar_first_name is null then raise exception 'CELLAR_INVESTOR_FIRST_NAME_REQUIRED' using errcode = '22023'; end if;
  if cellar_last_name is null then raise exception 'CELLAR_INVESTOR_LAST_NAME_REQUIRED' using errcode = '22023'; end if;
  if cellar_category not in ('individual', 'angel', 'fund', 'family_office', 'strategic', 'advisor', 'other') then raise exception 'CELLAR_INVESTOR_CATEGORY_REQUIRED' using errcode = '22023'; end if;
  if to_regclass('public.boh_user') is not null and exists (select 1 from public.boh_user bu where lower(bu.email) = cellar_email) then
    normalized_email := cellar_email; is_staff_email := true; patron_person_id := null; investor_access_id := null; investor_profile_id := null; access_status := null; profile_status := null; return next; return;
  end if;
  if to_regclass('public.patron_person') is not null then
    select pp.id, pp.person_type_key into cellar_patron_person_id, cellar_patron_person_type_key from public.patron_person pp where lower(pp.email) = cellar_email limit 1;
    if cellar_patron_person_type_key = 'staff_internal' then
      normalized_email := cellar_email; is_staff_email := true; patron_person_id := cellar_patron_person_id; investor_access_id := null; investor_profile_id := null; access_status := null; profile_status := null; return next; return;
    end if;
    cellar_full_name := cellar_first_name || ' ' || cellar_last_name;
    if cellar_patron_person_id is null then
      insert into public.patron_person (first_name, last_name, email, display_name, source, person_type_key, app_context)
      values (cellar_first_name, cellar_last_name, cellar_email, cellar_full_name, 'cellar_investor_profile_request', 'investor', 'patron')
      returning id into cellar_patron_person_id;
    else
      update public.patron_person set first_name = coalesce(nullif(trim(first_name), ''), cellar_first_name), last_name = coalesce(nullif(trim(last_name), ''), cellar_last_name), display_name = coalesce(nullif(trim(display_name), ''), cellar_full_name), person_type_key = case when person_type_key = 'staff_internal' then person_type_key else 'investor' end, app_context = coalesce(app_context, 'patron'), source = coalesce(source, 'cellar_investor_profile_request') where id = cellar_patron_person_id and coalesce(person_type_key, '') <> 'staff_internal';
    end if;
  end if;
  select cia.id into cellar_investor_access_id from public.cellar_investor_access cia where lower(cia.email) = cellar_email limit 1;
  if cellar_investor_access_id is null then
    insert into public.cellar_investor_access (patron_crm_id, patron_person_id, auth_user_id, email, full_name, company, title, access_status, pipeline_status, consent_metadata, metadata)
    values (cellar_patron_person_id::text, cellar_patron_person_id, p_auth_user_id, cellar_email, cellar_first_name || ' ' || cellar_last_name, nullif(trim(coalesce(p_company, '')), ''), nullif(trim(coalesce(p_title, '')), ''), 'verification_pending', 'profile_submitted', jsonb_build_object('profile_submitted_at', now()), coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'cellar_verified_access_drawer'))
    returning id into cellar_investor_access_id;
  else
    update public.cellar_investor_access set patron_crm_id = coalesce(patron_crm_id, cellar_patron_person_id::text), patron_person_id = coalesce(patron_person_id, cellar_patron_person_id), auth_user_id = coalesce(auth_user_id, p_auth_user_id), full_name = cellar_first_name || ' ' || cellar_last_name, company = nullif(trim(coalesce(p_company, company, '')), ''), title = nullif(trim(coalesce(p_title, title, '')), ''), access_status = case when access_status in ('verified', 'appendix_requested', 'appendix_granted') then access_status else 'verification_pending' end, pipeline_status = case when access_status in ('verified', 'appendix_requested', 'appendix_granted') then pipeline_status else 'profile_submitted' end, consent_metadata = consent_metadata || jsonb_build_object('profile_submitted_at', now()), metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_cellar_profile_submit_at', now()) where id = cellar_investor_access_id;
  end if;
  insert into public.cellar_investor_profiles (investor_access_id, patron_person_id, auth_user_id, email, first_name, last_name, investor_category, title, company, profile_status, consent_metadata, metadata)
  values (cellar_investor_access_id, cellar_patron_person_id, p_auth_user_id, cellar_email, cellar_first_name, cellar_last_name, cellar_category, nullif(trim(coalesce(p_title, '')), ''), nullif(trim(coalesce(p_company, '')), ''), 'verification_pending', jsonb_build_object('terms_accepted_at', now()), coalesce(p_metadata, '{}'::jsonb))
  on conflict (investor_access_id) do update set patron_person_id = excluded.patron_person_id, auth_user_id = excluded.auth_user_id, email = excluded.email, first_name = excluded.first_name, last_name = excluded.last_name, investor_category = excluded.investor_category, title = excluded.title, company = excluded.company, profile_status = case when public.cellar_investor_profiles.profile_status = 'verified' then 'verified' else 'verification_pending' end, consent_metadata = public.cellar_investor_profiles.consent_metadata || excluded.consent_metadata, metadata = public.cellar_investor_profiles.metadata || excluded.metadata, submitted_at = now()
  returning id into cellar_investor_profile_id;
  normalized_email := cellar_email; is_staff_email := false; patron_person_id := cellar_patron_person_id; investor_access_id := cellar_investor_access_id; investor_profile_id := cellar_investor_profile_id;
  select cia.access_status into access_status from public.cellar_investor_access cia where cia.id = cellar_investor_access_id;
  select cip.profile_status into profile_status from public.cellar_investor_profiles cip where cip.id = cellar_investor_profile_id;
  return next;
end;
$$;
