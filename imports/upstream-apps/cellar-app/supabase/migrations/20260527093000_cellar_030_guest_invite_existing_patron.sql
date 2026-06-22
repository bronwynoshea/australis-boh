-- CELLAR guest invites may reuse existing Patron people; only BOH users are blocked.

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
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_first text := nullif(split_part(coalesce(nullif(trim(coalesce(p_full_name, '')), ''), lower(trim(coalesce(p_email, '')))), ' ', 1), '');
  v_last text := nullif(trim(regexp_replace(coalesce(nullif(trim(coalesce(p_full_name, '')), ''), ''), '^\S+\s*', '')), '');
  v_patron_id uuid;
  v_patron_type text;
  v_access_id uuid;
  v_created boolean := false;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'CELLAR_INVESTOR_EMAIL_REQUIRED' using errcode = '22023';
  end if;
  if to_regclass('public.boh_user') is not null
    and exists (select 1 from public.boh_user where lower(email) = v_email) then
    normalized_email := v_email; is_staff_email := true; patron_person_id := null;
    investor_access_id := null; investor_access_created := false; return next; return;
  end if;

  if to_regclass('public.patron_person') is not null then
    select id, person_type_key into v_patron_id, v_patron_type
    from public.patron_person where lower(email) = v_email limit 1;
    if v_patron_id is null then
      insert into public.patron_person(
        first_name, last_name, email, display_name, source, person_type_key, app_context
      ) values (
        v_first, v_last, v_email, coalesce(v_name, v_email),
        'cellar_guest_code_email', 'investor', 'patron'
      ) returning id into v_patron_id;
    else
      update public.patron_person set
        person_type_key = case when coalesce(person_type_key, '') in ('', 'investor') then 'investor' else person_type_key end,
        app_context = coalesce(app_context, 'patron'),
        display_name = coalesce(display_name, v_name, v_email),
        source = coalesce(source, 'cellar_guest_code_email')
      where id = v_patron_id;
    end if;
  end if;

  select id into v_access_id from public.cellar_investor_access where lower(email) = v_email limit 1;
  if v_access_id is null then
    insert into public.cellar_investor_access(
      patron_crm_id, patron_person_id, email, full_name, company, title,
      source_access_code_id, access_status, pipeline_status,
      created_by_boh_user_id, updated_by_boh_user_id, metadata
    ) values (
      v_patron_id::text, v_patron_id, v_email, v_name,
      nullif(trim(coalesce(p_company, '')), ''), nullif(trim(coalesce(p_title, '')), ''),
      p_source_access_code_id, 'guest', 'guest_code_sent', p_boh_user_id, p_boh_user_id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', 'cellar_guest_code_email', 'existing_patron_person_type_key', v_patron_type)
    ) returning id into v_access_id;
    v_created := true;
  else
    update public.cellar_investor_access set
      patron_crm_id = coalesce(patron_crm_id, v_patron_id::text),
      patron_person_id = coalesce(patron_person_id, v_patron_id),
      full_name = coalesce(nullif(trim(coalesce(full_name, '')), ''), v_name),
      company = coalesce(nullif(trim(coalesce(company, '')), ''), nullif(trim(coalesce(p_company, '')), '')),
      title = coalesce(nullif(trim(coalesce(title, '')), ''), nullif(trim(coalesce(p_title, '')), '')),
      source_access_code_id = coalesce(source_access_code_id, p_source_access_code_id),
      pipeline_status = case when pipeline_status = 'guest_reviewing' then 'guest_code_sent' else pipeline_status end,
      updated_by_boh_user_id = p_boh_user_id,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('last_cellar_guest_code_email_at', now(), 'existing_patron_person_type_key', v_patron_type)
    where id = v_access_id;
  end if;
  normalized_email := v_email; is_staff_email := false; patron_person_id := v_patron_id;
  investor_access_id := v_access_id; investor_access_created := v_created; return next;
end;
$$;

-- Invite sender owns existing contacts that were invited before this rule was added.
update public.cellar_investor_access
set assigned_boh_user_id = guest_code_sent_from_boh_user_id
where pipeline_status = 'guest_code_sent'
  and guest_code_sent_from_boh_user_id is not null;
