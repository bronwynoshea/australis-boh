-- CELLAR shared guest-code management. Hashes only; plaintext is generated outside DB.

alter table public.cellar_investor_access
  add column if not exists patron_person_id uuid;

do $$
begin
  if to_regclass('public.patron_person') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'cellar_investor_access_patron_person_id_fkey'
        and conrelid = 'public.cellar_investor_access'::regclass
    )
  then
    alter table public.cellar_investor_access
      add constraint cellar_investor_access_patron_person_id_fkey
      foreign key (patron_person_id)
      references public.patron_person(id)
      on delete set null
      not valid;
  end if;
end $$;

create index if not exists cellar_investor_access_patron_person_id_idx
  on public.cellar_investor_access (patron_person_id);

create or replace function public.cellar_expire_guest_access_codes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_expired_count integer := 0;
begin
  update public.cellar_guest_access_codes
  set
    status = 'expired',
    metadata = metadata || jsonb_build_object('cellar_expired_by', 'cellar_expire_guest_access_codes')
  where status = 'active'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics cellar_expired_count = row_count;
  return cellar_expired_count;
end;
$$;

comment on function public.cellar_expire_guest_access_codes() is
  'CELLAR service helper: expires active shared guest codes after their 14-day window.';

create or replace function public.cellar_current_guest_access_code_summary()
returns table(
  guest_access_code_id uuid,
  status text,
  issued_at timestamptz,
  expires_at timestamptz,
  reset_at timestamptz,
  days_remaining integer
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
    greatest(ceil(extract(epoch from (cgac.expires_at - now())) / 86400)::integer, 0)
  from public.cellar_guest_access_codes as cgac
  where cgac.status = 'active'
  order by cgac.issued_at desc
  limit 1;
end;
$$;

comment on function public.cellar_current_guest_access_code_summary() is
  'CELLAR service helper: returns active shared guest-code metadata only, never plaintext.';

create or replace function public.cellar_reset_guest_access_code(
  p_code_hash text,
  p_boh_user_id text,
  p_reset_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(guest_access_code_id uuid, issued_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_code_id uuid;
  cellar_issued_at timestamptz := now();
  cellar_expires_at timestamptz := cellar_issued_at + interval '14 days';
begin
  if p_code_hash is null or length(trim(p_code_hash)) < 32 then
    raise exception 'CELLAR_CODE_HASH_REQUIRED' using errcode = '22023';
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
  return next;
end;
$$;

comment on function public.cellar_reset_guest_access_code(text, text, text, jsonb) is
  'CELLAR service helper: replaces the active shared guest code with a hash-only 14-day code.';

create or replace function public.cellar_prepare_guest_code_email(
  p_email text,
  p_full_name text default null,
  p_company text default null,
  p_title text default null,
  p_boh_user_id text default null,
  p_source_access_code_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(
  normalized_email text,
  is_staff_email boolean,
  patron_person_id uuid,
  investor_access_id uuid,
  investor_access_created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_email text := lower(trim(coalesce(p_email, '')));
  cellar_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  cellar_first_name text;
  cellar_last_name text;
  cellar_patron_person_id uuid;
  cellar_patron_person_type_key text;
  cellar_investor_access_id uuid;
  cellar_created boolean := false;
begin
  if cellar_email = '' or position('@' in cellar_email) = 0 then
    raise exception 'CELLAR_INVESTOR_EMAIL_REQUIRED' using errcode = '22023';
  end if;

  if to_regclass('public.boh_user') is not null and exists (
    select 1 from public.boh_user bu where lower(bu.email) = cellar_email
  ) then
    normalized_email := cellar_email;
    is_staff_email := true;
    patron_person_id := null;
    investor_access_id := null;
    investor_access_created := false;
    return next;
    return;
  end if;

  if to_regclass('public.patron_person') is not null then
    select pp.id, pp.person_type_key
      into cellar_patron_person_id, cellar_patron_person_type_key
    from public.patron_person pp
    where lower(pp.email) = cellar_email
    limit 1;

    if cellar_patron_person_type_key = 'staff_internal' then
      normalized_email := cellar_email;
      is_staff_email := true;
      patron_person_id := cellar_patron_person_id;
      investor_access_id := null;
      investor_access_created := false;
      return next;
      return;
    end if;

    cellar_first_name := nullif(split_part(coalesce(cellar_full_name, cellar_email), ' ', 1), '');
    cellar_last_name := nullif(trim(regexp_replace(coalesce(cellar_full_name, ''), '^\S+\s*', '')), '');

    if cellar_patron_person_id is null then
      insert into public.patron_person (
        first_name,
        last_name,
        email,
        display_name,
        source,
        person_type_key,
        app_context
      )
      values (
        cellar_first_name,
        cellar_last_name,
        cellar_email,
        coalesce(cellar_full_name, cellar_email),
        'cellar_guest_code_email',
        'investor',
        'patron'
      )
      returning id into cellar_patron_person_id;
    else
      update public.patron_person
      set
        person_type_key = case when person_type_key = 'staff_internal' then person_type_key else 'investor' end,
        app_context = coalesce(app_context, 'patron'),
        display_name = coalesce(display_name, cellar_full_name, cellar_email),
        source = coalesce(source, 'cellar_guest_code_email')
      where id = cellar_patron_person_id
        and coalesce(person_type_key, '') <> 'staff_internal';
    end if;
  end if;

  select cia.id into cellar_investor_access_id
  from public.cellar_investor_access cia
  where lower(cia.email) = cellar_email
  limit 1;

  if cellar_investor_access_id is null then
    insert into public.cellar_investor_access (
      patron_crm_id,
      patron_person_id,
      email,
      full_name,
      company,
      title,
      source_access_code_id,
      access_status,
      pipeline_status,
      created_by_boh_user_id,
      updated_by_boh_user_id,
      metadata
    )
    values (
      cellar_patron_person_id::text,
      cellar_patron_person_id,
      cellar_email,
      cellar_full_name,
      nullif(trim(coalesce(p_company, '')), ''),
      nullif(trim(coalesce(p_title, '')), ''),
      p_source_access_code_id,
      'guest',
      'guest_code_sent',
      p_boh_user_id,
      p_boh_user_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'cellar_guest_code_email')
    )
    returning id into cellar_investor_access_id;
    cellar_created := true;
  else
    update public.cellar_investor_access
    set
      patron_crm_id = coalesce(patron_crm_id, cellar_patron_person_id::text),
      patron_person_id = coalesce(patron_person_id, cellar_patron_person_id),
      full_name = coalesce(nullif(trim(coalesce(full_name, '')), ''), cellar_full_name),
      company = coalesce(nullif(trim(coalesce(company, '')), ''), nullif(trim(coalesce(p_company, '')), '')),
      title = coalesce(nullif(trim(coalesce(title, '')), ''), nullif(trim(coalesce(p_title, '')), '')),
      source_access_code_id = coalesce(source_access_code_id, p_source_access_code_id),
      pipeline_status = case when pipeline_status = 'guest_reviewing' then 'guest_code_sent' else pipeline_status end,
      updated_by_boh_user_id = p_boh_user_id,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_cellar_guest_code_email_at', now())
    where id = cellar_investor_access_id;
  end if;

  normalized_email := cellar_email;
  is_staff_email := false;
  patron_person_id := cellar_patron_person_id;
  investor_access_id := cellar_investor_access_id;
  investor_access_created := cellar_created;
  return next;
end;
$$;

comment on function public.cellar_prepare_guest_code_email(text, text, text, text, text, uuid, jsonb) is
  'CELLAR service helper: prepares a Patron/CELLAR investor invite record for non-staff emails only.';

revoke execute on function public.cellar_expire_guest_access_codes() from public, anon, authenticated;
revoke execute on function public.cellar_current_guest_access_code_summary() from public, anon, authenticated;
revoke execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.cellar_prepare_guest_code_email(text, text, text, text, text, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.cellar_expire_guest_access_codes() to service_role;
grant execute on function public.cellar_current_guest_access_code_summary() to service_role;
grant execute on function public.cellar_reset_guest_access_code(text, text, text, jsonb) to service_role;
grant execute on function public.cellar_prepare_guest_code_email(text, text, text, text, text, uuid, jsonb) to service_role;
