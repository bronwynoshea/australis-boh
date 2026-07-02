-- Tenant workspace app registry cleanup.
--
-- BOH dashboard is a company workspace shell. BOH Suite modules are tenant-scoped
-- operating apps; workspace links are tenant-owned products, websites, and
-- connected external apps. JOBZCAFE products are not global defaults for
-- Australis.

begin;

do $$
declare
  australis_tenant_id uuid;
  jobzcafe_tenant_id uuid;
  app_id_value uuid;
  app_slug text;
begin
  select id into australis_tenant_id from public.boh_tenant where slug = 'australis';
  select id into jobzcafe_tenant_id from public.boh_tenant where slug = 'jobzcafe';

  if australis_tenant_id is null then
    raise notice 'Australis tenant missing; skipping Australis workspace registry cleanup.';
  else
    -- Central is no longer a product/workspace identity in Australis BOH.
    delete from public.boh_tenant_app
    where tenant_id = australis_tenant_id
      and app_id in (select id from public.boh_app where slug in ('central', 'central-command'));

    -- JOBZCAFE-owned products do not belong in the Australis workspace registry.
    delete from public.boh_tenant_app
    where tenant_id = australis_tenant_id
      and app_id in (
        select id
        from public.boh_app
        where slug in ('studio', 'talent', 'dna', 'cafe', 'journey', 'coach', 'mentor')
      );

    -- Australis BOH Suite modules: internal company workspace apps enabled for the tenant.
    foreach app_slug in array array[
      'cellar', 'chatz', 'counter', 'cookbook', 'crew', 'forge', 'keep', 'ledger',
      'loft', 'menu', 'patron', 'slotz', 'tablez'
    ] loop
      select id into app_id_value
      from public.boh_app
      where slug = app_slug
        and is_active = true
      limit 1;

      if app_id_value is not null then
        insert into public.boh_tenant_app (
          tenant_id, app_id, status, app_kind, display_name, launch_route, external_url, metadata
        )
        values (
          australis_tenant_id,
          app_id_value,
          'enabled',
          'boh',
          null,
          null,
          null,
          jsonb_build_object(
            'workspace_section', 'boh_suite',
            'purpose', 'Australis internal company workspace capability'
          )
        )
        on conflict (tenant_id, app_id) do update
        set status = 'enabled',
            app_kind = 'boh',
            display_name = coalesce(public.boh_tenant_app.display_name, excluded.display_name),
            launch_route = null,
            external_url = null,
            metadata = public.boh_tenant_app.metadata || excluded.metadata,
            updated_at = now();
      end if;
    end loop;

    -- Website is a tenant workspace link for Australis, not a JOBZCAFE website shortcut.
    select id into app_id_value
    from public.boh_app
    where slug = 'website'
      and is_active = true
    limit 1;

    if app_id_value is not null then
      insert into public.boh_tenant_app (
        tenant_id, app_id, status, app_kind, display_name, launch_route, external_url, metadata
      )
      values (
        australis_tenant_id,
        app_id_value,
        'enabled',
        'external',
        'Australis Website',
        null,
        'https://australis.cloud',
        jsonb_build_object(
          'workspace_section', 'workspace_links',
          'owned_by_tenant', true,
          'future_capability', 'Tenant admins should be able to add/update workspace links from BOH.'
        )
      )
      on conflict (tenant_id, app_id) do update
      set status = 'enabled',
          app_kind = 'external',
          display_name = 'Australis Website',
          launch_route = null,
          external_url = 'https://australis.cloud',
          metadata = public.boh_tenant_app.metadata || excluded.metadata,
          updated_at = now();
    end if;
  end if;

  if jobzcafe_tenant_id is not null then
    -- Central is not the product identity for this BOH shell anymore.
    delete from public.boh_tenant_app
    where tenant_id = jobzcafe_tenant_id
      and app_id in (select id from public.boh_app where slug in ('central', 'central-command'));
  end if;
end $$;

commit;
