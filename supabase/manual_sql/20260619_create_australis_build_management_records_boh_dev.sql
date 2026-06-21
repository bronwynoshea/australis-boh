-- BOH-DEV only: create Australis-scoped management records for building Australis.
-- This keeps Australis product data in australis-dev; BOH-DEV is only the operating/planning layer.
-- Ownership model: Menu owns the initiative record (app_id = Menu); forge_status_id is only the
-- handoff/review state used by Forge to decide when to create execution workstreams.

begin;

do $$
declare
  australis_tenant_id uuid;
  jobzcafe_tenant_id uuid;
  admin_user_id uuid;
  menu_app_id uuid;
  forge_app_id uuid;
  counter_app_id uuid;
  australis_initiative_id uuid;
  australis_release_id uuid;
  stage_id uuid;
  init_status_id uuid;
  handoff_status_id uuid;
  workstream_status_id uuid;
  ticket_status_id uuid;
  ticket_priority_id uuid;
begin
  select id into jobzcafe_tenant_id from public.boh_tenant where slug = 'jobzcafe';

  insert into public.boh_tenant (slug, name, legal_name, status, app_context, metadata)
  values (
    'australis',
    'Australis',
    'Australis',
    'active',
    'boh',
    jsonb_build_object(
      'tenant_type', 'product_build_workspace',
      'managed_in', 'BOH-DEV',
      'product_repo', 'australis',
      'product_supabase_project', 'australis-dev',
      'note', 'BOH-DEV manages build work only; Australis product tables live in australis-dev.'
    )
  )
  on conflict (slug) do update
  set name = excluded.name,
      legal_name = excluded.legal_name,
      status = 'active',
      metadata = public.boh_tenant.metadata || excluded.metadata,
      updated_at = now()
  returning id into australis_tenant_id;

  select id into admin_user_id from public.boh_user where email = 'jobzcafe.ai@gmail.com' limit 1;

  if admin_user_id is not null then
    insert into public.boh_tenant_member (tenant_id, user_id, membership_status, is_default)
    values (australis_tenant_id, admin_user_id, 'active', false)
    on conflict (tenant_id, user_id) do update
    set membership_status = 'active', updated_at = now();
  end if;

  select id into menu_app_id from public.boh_app where slug = 'menu';
  select id into forge_app_id from public.boh_app where slug = 'forge';
  select id into counter_app_id from public.boh_app where slug = 'counter';

  insert into public.boh_tenant_app (tenant_id, app_id, status, app_kind, metadata)
  select australis_tenant_id, app_id, 'enabled', 'boh', jsonb_build_object('purpose', 'Manage Australis build work')
  from (values (menu_app_id), (forge_app_id), (counter_app_id)) as apps(app_id)
  where app_id is not null
  on conflict (tenant_id, app_id) do update
  set status = 'enabled', app_kind = 'boh', metadata = public.boh_tenant_app.metadata || excluded.metadata, updated_at = now();

  -- Lookup tables currently use globally unique keys, so reuse existing active lookup rows.
  -- Australis ownership is carried by tenant_id on the actual initiative/workstream/ticket records.
  select id into stage_id from public.boh_initiative_planning_stage where is_active and key in ('approved', 'submitted', 'draft') order by case key when 'approved' then 1 when 'submitted' then 2 else 3 end limit 1;
  select id into init_status_id from public.boh_initiative_status where is_active and key in ('planned', 'active', 'in_progress', 'approved') order by case key when 'active' then 1 when 'in_progress' then 2 when 'planned' then 3 else 4 end limit 1;
  select id into handoff_status_id from public.boh_initiative_forge_status where is_active and key in ('accepted', 'submitted', 'reviewed') order by case key when 'accepted' then 1 when 'submitted' then 2 else 3 end limit 1;
  select id into workstream_status_id from public.boh_workstream_status where is_active and key in ('in_progress', 'approved', 'draft') order by case key when 'in_progress' then 1 when 'approved' then 2 else 3 end limit 1;
  select id into ticket_status_id from public.counter_ticket_status where is_active and key in ('new', 'triage') order by case key when 'new' then 1 else 2 end limit 1;
  select id into ticket_priority_id from public.counter_ticket_priority where is_active and key in ('medium', 'high') order by case key when 'medium' then 1 else 2 end limit 1;

  insert into public.boh_release_version (
    version_label, version_number, release_date, status, notes, release_tier,
    sort_date, release_year, release_cycle, quarter, year, cycle, environment,
    summary, tenant_id
  )
  select
    'Australis Foundation Build', '0.1.0', current_date, 'in progress',
    'Australis-scoped BOH delivery release for building standalone Australis. Menu owns the initiative; Forge owns accepted execution workstreams. Australis product tables live in australis-dev.',
    'major', current_date, extract(year from current_date)::int, 'foundation',
    'Q' || extract(quarter from current_date)::int, extract(year from current_date)::int, 'foundation',
    'internal', 'Get standalone Australis running locally against australis-dev.', australis_tenant_id
  where not exists (
    select 1 from public.boh_release_version r where r.tenant_id = australis_tenant_id and r.version_label = 'Australis Foundation Build'
  );

  select id into australis_release_id from public.boh_release_version where tenant_id = australis_tenant_id and version_label = 'Australis Foundation Build' limit 1;

  insert into public.boh_initiative (
    title, description, status, app_id, planning_stage_id, status_id, forge_status_id,
    owner_user_id, priority_id, target_year, target_quarter, progress, tags, purpose,
    tenant_id
  )
  select
    'Build standalone Australis platform',
    'Use BOH-DEV as the operating/planning system to build standalone Australis in the separate australis repo and australis-dev Supabase project.',
    'planned', menu_app_id, stage_id, init_status_id, handoff_status_id,
    admin_user_id, null, extract(year from current_date)::int, 'Q' || extract(quarter from current_date)::int, 0,
    array['australis', 'standalone', 'internal-build', 'boh-managed'],
    'Create a usable standalone Australis workspace without mixing Australis product tables into BOH-DEV.',
    australis_tenant_id
  where not exists (
    select 1 from public.boh_initiative i where i.tenant_id = australis_tenant_id and i.title = 'Build standalone Australis platform'
  );

  select id into australis_initiative_id from public.boh_initiative where tenant_id = australis_tenant_id and title = 'Build standalone Australis platform' limit 1;

  insert into public.boh_initiative_release (initiative_id, release_id, tenant_id)
  select australis_initiative_id, australis_release_id, australis_tenant_id
  where australis_initiative_id is not null and australis_release_id is not null
    and not exists (select 1 from public.boh_initiative_release ir where ir.tenant_id = australis_tenant_id and ir.initiative_id = australis_initiative_id and ir.release_id = australis_release_id);

  -- Forge execution records start here: workstreams are created only after the Menu initiative is submitted/accepted.
  insert into public.boh_workstream (initiative_id, title, description, status_id, assigned_to, created_by, progress, tenant_id)
  select australis_initiative_id, title, description, workstream_status_id, admin_user_id, coalesce(admin_user_id, (select id from public.boh_user limit 1)), 0, australis_tenant_id
  from (values
    ('Australis local foundation and repo verification', 'Verify repo, branch, build scripts, local dev servers, and implementation log.'),
    ('Australis-dev schema foundation', 'Confirm clean standalone schema in australis-dev and seed only development foundation records.'),
    ('Australis app shell and login path', 'Verify app shell/login using australis-dev config and admin test user where needed.'),
    ('Central reference extraction', 'Extract useful Central concepts/patterns without copying central_* schema or BOH coupling.'),
    ('Australis BOH management adapter boundary', 'Define how BOH-DEV Menu/Forge/Counter records manage build work without storing Australis product tables.')
  ) as ws(title, description)
  where australis_initiative_id is not null
    and not exists (select 1 from public.boh_workstream w where w.tenant_id = australis_tenant_id and w.initiative_id = australis_initiative_id and w.title = ws.title);

  -- Create an intake Counter ticket for future Australis build bugs/blockers, separate from JOBZCAFE records.
  insert into public.counter_ticket (
    subject, description, category, app, created_by, requester_email, source,
    status_id, priority_id, app_id, app_context, tenant_id
  )
  select
    'Australis build blocker and bug intake',
    'Australis-scoped Counter intake. Bugs found while testing Australis should be filed under this tenant/workspace, separate from JOBZCAFE records.',
    'development', 'Australis', admin_user_id, 'jobzcafe.ai@gmail.com', 'manual',
    ticket_status_id, ticket_priority_id, counter_app_id, 'boh', australis_tenant_id
  where not exists (select 1 from public.counter_ticket c where c.tenant_id = australis_tenant_id and c.subject = 'Australis build blocker and bug intake');
end $$;

commit;

-- Verification summary.
select 'tenant' as record_type, slug as key, name, status, id::text
from public.boh_tenant where slug = 'australis'
union all
select 'initiative', title, title, status, id::text
from public.boh_initiative where tenant_id = (select id from public.boh_tenant where slug = 'australis') and title = 'Build standalone Australis platform'
union all
select 'release', version_label, version_label, status::text, id::text
from public.boh_release_version where tenant_id = (select id from public.boh_tenant where slug = 'australis') and version_label = 'Australis Foundation Build'
union all
select 'counter', subject, subject, 'open', id::text
from public.counter_ticket where tenant_id = (select id from public.boh_tenant where slug = 'australis') and subject = 'Australis build blocker and bug intake';

select title, description
from public.boh_workstream
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and initiative_id = (select id from public.boh_initiative where tenant_id = (select id from public.boh_tenant where slug = 'australis') and title = 'Build standalone Australis platform' limit 1)
order by title;
