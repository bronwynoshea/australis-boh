-- BOH-DEV only: seed/update BOH Vault + Australis Gateway Menu initiative and user stories.
-- Purpose: track the BOH-owned vault and Australis-owned Gateway API integration through BOH Menu.
-- Safe/idempotent draft. Review before applying to BOH-DEV. Do not run against production.

begin;

do $$
declare
  australis_tenant_id uuid;
  admin_user_id uuid;
  menu_app_id uuid;
  stage_id uuid;
  init_status_id uuid;
  draft_handoff_status_id uuid;
  initiative_id uuid;
  current_year int := extract(year from current_date)::int;
  current_quarter text := 'Q' || extract(quarter from current_date)::int;
begin
  select id into australis_tenant_id from public.boh_tenant where slug = 'australis';

  if australis_tenant_id is null then
    raise exception 'Missing BOH tenant slug=australis. Run/confirm Australis BOH tenant bootstrap first.';
  end if;

  select id into admin_user_id
  from public.boh_user
  where lower(email) in ('admin@australis.cloud', 'jobzcafe.ai@gmail.com')
  order by case when lower(email) = 'admin@australis.cloud' then 1 else 2 end
  limit 1;

  select id into menu_app_id from public.boh_app where slug = 'menu' limit 1;

  select id into stage_id
  from public.boh_initiative_planning_stage
  where is_active and key in ('draft', 'planning', 'approved', 'submitted')
  order by case key when 'draft' then 1 when 'planning' then 2 when 'approved' then 3 else 4 end
  limit 1;

  select id into init_status_id
  from public.boh_initiative_status
  where is_active and key in ('planned', 'active', 'in_progress', 'approved')
  order by case key when 'planned' then 1 when 'active' then 2 when 'in_progress' then 3 else 4 end
  limit 1;

  select id into draft_handoff_status_id
  from public.boh_initiative_forge_status
  where is_active and key in ('draft', 'ready')
  order by case key when 'draft' then 1 else 2 end
  limit 1;

  if menu_app_id is null then
    raise exception 'Missing BOH app slug=menu.';
  end if;

  insert into public.boh_initiative (
    title, description, status, app_id, planning_stage_id, status_id, forge_status_id,
    owner_user_id, target_year, target_quarter, progress, tags, purpose, tenant_id
  )
  values (
    'BOH Vault and Australis Gateway credential foundation',
    'Build BOH Vault as the governed place for development and live Supabase keys, provider API keys, passwords, secure notes, and operational secrets, while keeping the Australis AI Gateway API and route execution inside Australis using approved vault-backed credential references.',
    'planned', menu_app_id, stage_id, init_status_id, draft_handoff_status_id,
    admin_user_id, current_year, current_quarter, 0,
    array['boh', 'australis', 'vault', 'credentials', 'supabase', 'ai-gateway', 'security', 'menu-to-forge'],
    'Create a BOH-owned vault for platform secrets and a clean Australis Gateway integration so development and live credentials live in one governed place without making Australis the password manager.',
    australis_tenant_id
  )
  on conflict do nothing;

  select id into initiative_id
  from public.boh_initiative
  where tenant_id = australis_tenant_id
    and title = 'BOH Vault and Australis Gateway credential foundation'
  limit 1;

  update public.boh_initiative
  set description = 'Build BOH Vault as the governed place for development and live Supabase keys, provider API keys, passwords, secure notes, and operational secrets, while keeping the Australis AI Gateway API and route execution inside Australis using approved vault-backed credential references.',
      purpose = 'Create a BOH-owned vault for platform secrets and a clean Australis Gateway integration so development and live credentials live in one governed place without making Australis the password manager.',
      app_id = menu_app_id,
      planning_stage_id = stage_id,
      status_id = init_status_id,
      forge_status_id = draft_handoff_status_id,
      tags = array['boh', 'australis', 'vault', 'credentials', 'supabase', 'ai-gateway', 'security', 'menu-to-forge'],
      updated_at = now()
  where id = initiative_id;

  insert into public.boh_user_story (initiative_id, title, description, acceptance_criteria, status, sort_order, is_archived, progress, tenant_id)
  select initiative_id, s.title, s.description, s.acceptance_criteria, 'not_started', s.sort_order, false, 0, australis_tenant_id
  from (values
    (1, 'BOH provides a compact Vault surface', 'As a BOH platform admin, I can use a compact vault-style list with search, filters, item types, and a detail drawer instead of oversized credential cards.', 'BOH has a Vault surface or planned screen spec; large hero/metric cards are avoided; rows support service keys, API keys, passwords, secure notes, webhook secrets, deploy keys, and recovery records.'),
    (2, 'Development and live Supabase secrets live in one governed place', 'As an internal Australis/BOH user, I can track development and production Supabase project URLs, publishable/anon keys, server-only keys, and dashboard login records in BOH Vault instead of notes files.', 'Vault item model supports app/product, provider, environment, status, used-for, owner, masked value controls, and clear development/production separation; raw secrets are not shown in list views.'),
    (3, 'Vault item detail drawer supports secure actions', 'As a vault admin, I can open an item drawer to add, replace, reveal, copy, rotate, disable, and annotate credentials according to my role.', 'Each vault item opens a detail drawer; secret values are masked; reveal/copy are explicit actions; rotate/disable actions exist as UI affordances; notes, ownership, app/product, and environment fields are supported.'),
    (4, 'Australis Gateway API stays inside Australis', 'As the Australis platform owner, I keep model/provider routing and gateway execution inside Australis while using BOH Vault as the credential source of truth.', 'PRD and implementation contract show Australis owns Gateway API/routes, provider/model/fallback status, and runtime routing; BOH Vault owns secret storage, status, access policy, and audit.'),
    (5, 'Australis Gateway routes reference BOH Vault keys', 'As a gateway operator, I can assign approved BOH Vault items to Australis Gateway routes without duplicating secret storage or exposing raw key values.', 'Gateway route model supports a stable vault credential reference; missing keys show Needs key; ready routes reference BOH Vault items; browser UI does not fetch raw secrets.'),
    (6, 'Security model and integration path are documented', 'As the platform owner, I can review the security requirements and integration choices before backend secret storage or brokered secret access is implemented.', 'PRD documents roles, reveal/copy rules, audit expectations, tenant/app/environment scoping, production secret restrictions, and open decisions for brokered fetch vs runtime secret sync vs inventory-only records.')
  ) as s(sort_order, title, description, acceptance_criteria)
  where initiative_id is not null
    and not exists (
      select 1 from public.boh_user_story us
      where us.initiative_id = initiative_id and us.title = s.title
    );
end $$;

commit;

-- Verification summary.
select
  i.title,
  i.status,
  fs.key as forge_status_key,
  i.target_quarter,
  i.target_year,
  coalesce(i.tags::text, '') as tags
from public.boh_initiative i
left join public.boh_initiative_forge_status fs on fs.id = i.forge_status_id
where i.tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and i.title = 'BOH Vault and Australis Gateway credential foundation';

select
  us.sort_order,
  us.title,
  us.status
from public.boh_user_story us
join public.boh_initiative i on i.id = us.initiative_id
where i.tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and i.title = 'BOH Vault and Australis Gateway credential foundation'
order by us.sort_order;
