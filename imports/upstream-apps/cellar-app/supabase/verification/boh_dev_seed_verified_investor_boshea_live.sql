-- BOH-DEV only: create/update a verified CELLAR investor profile for messaging QA.
-- Prerequisite: Supabase Auth user boshea@live.com must already exist.

begin;

do $$
declare
  cellar_email text := 'boshea@live.com';
  cellar_auth_user_id uuid;
  cellar_access_id uuid;
  cellar_profile_id uuid;
  boshea_boh_user_id text;
  alanum_boh_user_id text;
begin
  select au.id
    into cellar_auth_user_id
  from auth.users au
  where lower(au.email) = cellar_email
  order by au.created_at desc
  limit 1;

  if cellar_auth_user_id is null then
    raise exception 'Missing Supabase Auth user for %. Create/sign in this email first, then rerun this seed.', cellar_email;
  end if;

  if exists (
    select 1
    from public.boh_user bu
    where lower(bu.email) = cellar_email
  ) then
    raise exception '% is a BOH staff email, not an investor test email.', cellar_email;
  end if;

  select bu.id::text
    into boshea_boh_user_id
  from public.boh_user bu
  where lower(bu.email) = 'boshea@jobzcafe.com'
  limit 1;

  select bu.id::text
    into alanum_boh_user_id
  from public.boh_user bu
  where lower(bu.email) = 'alanum@jobzcafe.com'
  limit 1;

  insert into public.cellar_investor_access (
    auth_user_id,
    email,
    full_name,
    company,
    title,
    access_status,
    pipeline_status,
    investor_segment,
    verified_at,
    assigned_boh_user_id,
    created_by_boh_user_id,
    updated_by_boh_user_id,
    consent_metadata,
    metadata
  )
  values (
    cellar_auth_user_id,
    cellar_email,
    'Bronwyn O''Shea',
    'JOBZ CAFE test investor',
    'Verified investor QA',
    'verified',
    'new_investor',
    'qa_test',
    now(),
    boshea_boh_user_id,
    boshea_boh_user_id,
    boshea_boh_user_id,
    jsonb_build_object('verified_test_seed_at', now()),
    jsonb_build_object('source', 'boh_dev_seed_verified_investor_boshea_live')
  )
  on conflict (lower(email))
  do update set
    auth_user_id = excluded.auth_user_id,
    full_name = excluded.full_name,
    company = excluded.company,
    title = excluded.title,
    access_status = 'verified',
    pipeline_status = 'new_investor',
    investor_segment = excluded.investor_segment,
    verified_at = coalesce(public.cellar_investor_access.verified_at, now()),
    assigned_boh_user_id = coalesce(public.cellar_investor_access.assigned_boh_user_id, excluded.assigned_boh_user_id),
    updated_by_boh_user_id = excluded.updated_by_boh_user_id,
    consent_metadata = public.cellar_investor_access.consent_metadata || excluded.consent_metadata,
    metadata = public.cellar_investor_access.metadata || excluded.metadata
  returning id into cellar_access_id;

  insert into public.cellar_investor_profiles (
    investor_access_id,
    auth_user_id,
    email,
    first_name,
    last_name,
    investor_category,
    title,
    company,
    profile_status,
    consent_metadata,
    metadata,
    reviewed_at,
    reviewed_by_boh_user_id
  )
  values (
    cellar_access_id,
    cellar_auth_user_id,
    cellar_email,
    'Bronwyn',
    'O''Shea',
    'individual',
    'Verified investor QA',
    'JOBZ CAFE test investor',
    'verified',
    jsonb_build_object('verified_test_seed_at', now()),
    jsonb_build_object('source', 'boh_dev_seed_verified_investor_boshea_live'),
    now(),
    boshea_boh_user_id
  )
  on conflict (investor_access_id)
  do update set
    auth_user_id = excluded.auth_user_id,
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    investor_category = excluded.investor_category,
    title = excluded.title,
    company = excluded.company,
    profile_status = 'verified',
    consent_metadata = public.cellar_investor_profiles.consent_metadata || excluded.consent_metadata,
    metadata = public.cellar_investor_profiles.metadata || excluded.metadata,
    reviewed_at = now(),
    reviewed_by_boh_user_id = excluded.reviewed_by_boh_user_id
  returning id into cellar_profile_id;

  if boshea_boh_user_id is not null then
    insert into public.cellar_staff_visibility_permissions (
      investor_access_id,
      boh_user_id,
      permission_level,
      granted_by_boh_user_id,
      metadata
    )
    values (
      cellar_access_id,
      boshea_boh_user_id,
      'owner',
      boshea_boh_user_id,
      jsonb_build_object('source', 'boh_dev_seed_verified_investor_boshea_live')
    )
    on conflict (investor_access_id, boh_user_id)
    do update set
      permission_level = excluded.permission_level,
      granted_by_boh_user_id = excluded.granted_by_boh_user_id,
      metadata = public.cellar_staff_visibility_permissions.metadata || excluded.metadata,
      updated_at = now();
  end if;

  if alanum_boh_user_id is not null then
    insert into public.cellar_staff_visibility_permissions (
      investor_access_id,
      boh_user_id,
      permission_level,
      granted_by_boh_user_id,
      metadata
    )
    values (
      cellar_access_id,
      alanum_boh_user_id,
      'responder',
      boshea_boh_user_id,
      jsonb_build_object('source', 'boh_dev_seed_verified_investor_boshea_live')
    )
    on conflict (investor_access_id, boh_user_id)
    do update set
      permission_level = excluded.permission_level,
      granted_by_boh_user_id = excluded.granted_by_boh_user_id,
      metadata = public.cellar_staff_visibility_permissions.metadata || excluded.metadata,
      updated_at = now();
  end if;

  raise notice 'Verified CELLAR investor ready: %, access %, profile %', cellar_email, cellar_access_id, cellar_profile_id;
end $$;

select
  cia.id as investor_access_id,
  cia.email,
  cia.auth_user_id,
  cia.access_status,
  cia.pipeline_status,
  cia.assigned_boh_user_id,
  cip.id as investor_profile_id,
  cip.profile_status
from public.cellar_investor_access cia
left join public.cellar_investor_profiles cip on cip.investor_access_id = cia.id
where lower(cia.email) = 'boshea@live.com';

commit;
