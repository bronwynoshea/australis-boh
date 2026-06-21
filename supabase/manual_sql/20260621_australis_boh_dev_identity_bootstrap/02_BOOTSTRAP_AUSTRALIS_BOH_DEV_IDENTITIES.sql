-- BOH-DEV only: bootstrap Australis BOH identities + Patron records.
-- Prerequisite: matching BOH-DEV auth.users rows already exist.
-- This script never creates auth.users and never uses fake auth IDs.
-- Do not run in production.

begin;

do $$
declare
  australis_tenant_id uuid;
  app_id_value uuid;
  user_auth_id uuid;
  v_boh_user_id uuid;
  role_id_value uuid;
  role_code_value text;
  patron_org_id uuid;
  patron_person_id uuid;
  candidate record;
  app_slug text;
begin
  select id into australis_tenant_id
  from public.boh_tenant
  where slug = 'australis';

  if australis_tenant_id is null then
    raise exception 'Australis tenant is missing. Run/verify the BOH-DEV Australis tenant foundation first.';
  end if;

  -- Tenant-level BOH app enablement used to track Australis work.
  -- Patron is enabled so the Australis organisation/person records are visible if the app exists.
  foreach app_slug in array array['menu', 'forge', 'counter', 'patron'] loop
    select id into app_id_value
    from public.boh_app
    where slug = app_slug
      and app_context = 'boh'
    limit 1;

    if app_id_value is not null then
      insert into public.boh_tenant_app (tenant_id, app_id, status, app_kind, metadata)
      values (
        australis_tenant_id,
        app_id_value,
        'enabled',
        'boh',
        jsonb_build_object(
          'purpose', 'BOH-DEV Australis build/work tracking',
          'bootstrap', '20260621_australis_boh_dev_identity_bootstrap'
        )
      )
      on conflict (tenant_id, app_id) do update
      set status = 'enabled',
          app_kind = 'boh',
          metadata = public.boh_tenant_app.metadata || excluded.metadata,
          updated_at = now();
    else
      raise notice 'Skipping missing app slug: %', app_slug;
    end if;
  end loop;

  -- Create or update the Patron organisation for Australis visibility.
  select id into patron_org_id
  from public.patron_organisation
  where lower(name) = 'australis'
    and (tenant_id = australis_tenant_id or tenant_id is null)
  order by created_at nulls last
  limit 1;

  if patron_org_id is null then
    insert into public.patron_organisation (name, website, status, tenant_id, app_context)
    values ('Australis', 'https://australis.cloud', 'active', australis_tenant_id, 'patron')
    returning id into patron_org_id;
  else
    update public.patron_organisation
    set website = coalesce(website, 'https://australis.cloud'),
        status = coalesce(status, 'active'),
        tenant_id = coalesce(tenant_id, australis_tenant_id),
        updated_at = now()
    where id = patron_org_id;
  end if;

  for candidate in
    select *
    from (values
      (
        'admin@australis.cloud'::text,
        'Australis'::text,
        'Admin'::text,
        'admin'::text,
        array['menu', 'forge', 'counter', 'patron']::text[],
        true
      ),
      (
        'hello@australis.cloud'::text,
        'Australis'::text,
        'Hello'::text,
        'staff'::text,
        array['menu', 'counter', 'patron']::text[],
        false
      )
    ) as v(email, first_name, last_name, desired_role_code, app_slugs, is_default_member)
  loop
    select id into user_auth_id
    from auth.users
    where lower(email) = lower(candidate.email)
    limit 1;

    if user_auth_id is null then
      raise notice 'Skipping %, no BOH-DEV auth.users row exists yet. Create/invite the Auth user first, then rerun this script.', candidate.email;
      continue;
    end if;

    select id into v_boh_user_id
    from public.boh_user
    where app_context = 'boh'
      and (auth_user_id = user_auth_id or lower(email) = lower(candidate.email))
    order by case when auth_user_id = user_auth_id then 0 else 1 end
    limit 1;

    if v_boh_user_id is null then
      insert into public.boh_user (
        auth_user_id,
        email,
        first_name,
        last_name,
        full_name,
        status,
        primary_role_hint,
        app_context,
        tenant_id
      )
      values (
        user_auth_id,
        lower(candidate.email),
        candidate.first_name,
        candidate.last_name,
        trim(candidate.first_name || ' ' || candidate.last_name),
        'active',
        candidate.desired_role_code,
        'boh',
        australis_tenant_id
      )
      returning id into v_boh_user_id;
    else
      update public.boh_user
      set auth_user_id = user_auth_id,
          email = lower(candidate.email),
          first_name = coalesce(first_name, candidate.first_name),
          last_name = coalesce(last_name, candidate.last_name),
          full_name = coalesce(nullif(full_name, ''), trim(candidate.first_name || ' ' || candidate.last_name)),
          status = 'active',
          primary_role_hint = candidate.desired_role_code,
          tenant_id = coalesce(tenant_id, australis_tenant_id),
          updated_at = now()
      where id = v_boh_user_id;
    end if;

    insert into public.boh_tenant_member (tenant_id, user_id, membership_status, is_default)
    values (australis_tenant_id, v_boh_user_id, 'active', candidate.is_default_member)
    on conflict (tenant_id, user_id) do update
    set membership_status = 'active',
        is_default = excluded.is_default,
        updated_at = now();

    -- Prefer the requested role code, but fall back safely for older BOH-DEV role sets.
    select id, code into role_id_value, role_code_value
    from public.boh_role
    where app_context = 'boh'
      and code = candidate.desired_role_code
    limit 1;

    if role_id_value is null and candidate.desired_role_code = 'admin' then
      select id, code into role_id_value, role_code_value
      from public.boh_role
      where app_context = 'boh'
        and code in ('super_admin', 'staff')
      order by case code when 'super_admin' then 1 when 'staff' then 2 else 3 end
      limit 1;
    elsif role_id_value is null then
      select id, code into role_id_value, role_code_value
      from public.boh_role
      where app_context = 'boh'
        and code in ('staff', 'admin', 'super_admin')
      order by case code when 'staff' then 1 when 'admin' then 2 when 'super_admin' then 3 else 4 end
      limit 1;
    end if;

    if role_id_value is not null then
      update public.boh_user
      set primary_role_hint = role_code_value,
          updated_at = now()
      where id = v_boh_user_id;

      if not exists (
        select 1
        from public.boh_user_role
        where user_id = v_boh_user_id
          and role_id = role_id_value
          and app_context = 'boh'
          and tenant_id = australis_tenant_id
      ) then
        insert into public.boh_user_role (user_id, role_id, app_context, tenant_id)
        values (v_boh_user_id, role_id_value, 'boh', australis_tenant_id);
      end if;
    else
      raise notice 'No usable BOH role found for %, leaving role assignment empty.', candidate.email;
    end if;

    foreach app_slug in array candidate.app_slugs loop
      select id into app_id_value
      from public.boh_app
      where slug = app_slug
        and app_context = 'boh'
      limit 1;

      if app_id_value is not null and not exists (
        select 1
        from public.boh_user_app
        where user_id = v_boh_user_id
          and app_id = app_id_value
          and app_context = 'boh'
          and tenant_id = australis_tenant_id
      ) then
        insert into public.boh_user_app (user_id, app_id, permission_level, app_context, tenant_id)
        values (v_boh_user_id, app_id_value, 'edit', 'boh', australis_tenant_id);
      end if;
    end loop;

    select id into patron_person_id
    from public.patron_person
    where lower(email) = lower(candidate.email)
      and (tenant_id = australis_tenant_id or tenant_id is null)
    order by created_at nulls last
    limit 1;

    if patron_person_id is null then
      insert into public.patron_person (
        first_name,
        last_name,
        email,
        source,
        boh_user_id,
        created_by,
        tenant_id
      )
      values (
        candidate.first_name,
        candidate.last_name,
        lower(candidate.email),
        'boh_dev_australis_identity_bootstrap',
        v_boh_user_id,
        v_boh_user_id,
        australis_tenant_id
      )
      returning id into patron_person_id;
    else
      update public.patron_person p
      set first_name = coalesce(p.first_name, candidate.first_name),
          last_name = coalesce(p.last_name, candidate.last_name),
          email = lower(candidate.email),
          source = coalesce(p.source, 'boh_dev_australis_identity_bootstrap'),
          boh_user_id = coalesce(p.boh_user_id, v_boh_user_id),
          tenant_id = coalesce(p.tenant_id, australis_tenant_id),
          updated_at = now()
      where p.id = patron_person_id;
    end if;

    if patron_org_id is not null and patron_person_id is not null and exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'patron_person_organisation'
    ) and not exists (
      select 1
      from public.patron_person_organisation
      where person_id = patron_person_id
        and organisation_id = patron_org_id
    ) then
      insert into public.patron_person_organisation (person_id, organisation_id)
      values (patron_person_id, patron_org_id);
    end if;
  end loop;
end $$;

commit;

-- Immediate summary. Run 03_VERIFY_AUSTRALIS_IDENTITY_BOOTSTRAP.sql for the fuller checklist.
select
  lower(u.email) as email,
  u.auth_user_id,
  u.status,
  u.primary_role_hint,
  t.slug as tenant_slug,
  tm.membership_status
from public.boh_user u
left join public.boh_tenant t on t.id = u.tenant_id
left join public.boh_tenant_member tm on tm.user_id = u.id and tm.tenant_id = (select id from public.boh_tenant where slug = 'australis')
where lower(u.email) in ('admin@australis.cloud', 'hello@australis.cloud')
order by lower(u.email);
