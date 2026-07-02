-- BOH-DEV only: seed/update Australis rollout Menu initiatives and user stories.
-- Purpose: start Australis rollout through BOH Menu -> Forge without mutating Australis runtime tables.
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
  ready_handoff_status_id uuid;
  bootstrap_initiative_id uuid;
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

  select id into ready_handoff_status_id
  from public.boh_initiative_forge_status
  where is_active and key in ('ready', 'submitted', 'accepted')
  order by case key when 'ready' then 1 when 'submitted' then 2 else 3 end
  limit 1;

  if menu_app_id is null then
    raise exception 'Missing BOH app slug=menu.';
  end if;

  -- Initiative 1: bootstrap foundation. This is the only initiative intended to be pushed to Forge first.
  insert into public.boh_initiative (
    title, description, status, app_id, planning_stage_id, status_id, forge_status_id,
    owner_user_id, target_year, target_quarter, progress, tags, purpose, tenant_id
  )
  values (
    'Bootstrap Australis autonomous business foundation',
    'Confirm BOH Australis entity tenant, admin user, BOH billing/Patron entitlement boundary, and minimum Australis platform foundation needed before hello@australis.cloud can onboard as the business-manager user.',
    'planned', menu_app_id, stage_id, init_status_id, coalesce(ready_handoff_status_id, draft_handoff_status_id),
    admin_user_id, current_year, current_quarter, 0,
    array['australis', 'bootstrap', 'autonomous-business', 'menu-to-forge'],
    'Create the safe bootstrap layer for the Australis entity to build, run, market, sell, and support Australis platform and BOH.',
    australis_tenant_id
  )
  on conflict do nothing;

  select id into bootstrap_initiative_id
  from public.boh_initiative
  where tenant_id = australis_tenant_id
    and title = 'Bootstrap Australis autonomous business foundation'
  limit 1;

  -- Upsert-style updates by title for idempotence where conflict constraints are unknown.
  update public.boh_initiative
  set description = 'Confirm BOH Australis entity tenant, admin user, BOH billing/Patron entitlement boundary, and minimum Australis platform foundation needed before hello@australis.cloud can onboard as the business-manager user.',
      forge_status_id = coalesce(ready_handoff_status_id, draft_handoff_status_id),
      updated_at = now()
  where id = bootstrap_initiative_id;

  -- Helper: create user stories for bootstrap.
  insert into public.boh_user_story (initiative_id, title, description, acceptance_criteria, status, sort_order, is_archived, progress, tenant_id)
  select bootstrap_initiative_id, s.title, s.description, s.acceptance_criteria, 'not_started', s.sort_order, false, 0, australis_tenant_id
  from (values
    (1, 'Admin user can operate Australis setup', 'As the Australis platform admin, admin@australis.cloud can access the Australis entity operating context and manage setup safely.', 'admin@australis.cloud access is confirmed; admin can access required Australis/BOH setup surfaces; no production systems are touched.'),
    (2, 'BOH owns Australis/BOH billing and entitlement truth', 'As the Australis entity, BOH owns CRM, Stripe subscriptions, billing, and product entitlements for Australis-only, BOH-only, and bundled customers.', 'PRD and implementation plan confirm BOH/Patron/billing as source of truth; Australis runtime only stores entitlement snapshots.'),
    (3, 'hello@australis.cloud onboarding path is defined', 'As the first normal Australis business-manager user, hello@australis.cloud has a defined onboarding path into a real Australis tenant/workspace/profile/membership/access state.', 'Onboarding path and required tables/functions are identified; missing pieces are represented as Forge-ready tasks.'),
    (4, 'JOBZCAFE product customers are out of scope', 'As the Australis entity, we do not use JOBZCAFE product end-customer billing/runtime for Australis/BOH customer management.', 'Boundary is documented; test data and provisioning plans do not depend on JOBZCAFE product customer tables.')
  ) as s(sort_order, title, description, acceptance_criteria)
  where bootstrap_initiative_id is not null
    and not exists (
      select 1 from public.boh_user_story us
      where us.initiative_id = bootstrap_initiative_id and us.title = s.title
    );

  -- Draft Menu initiatives to keep in Menu until bootstrap is accepted.
  insert into public.boh_initiative (
    title, description, status, app_id, planning_stage_id, status_id, forge_status_id,
    owner_user_id, target_year, target_quarter, progress, tags, purpose, tenant_id
  )
  select
    v.title, v.description, 'planned', menu_app_id, stage_id, init_status_id, draft_handoff_status_id,
    admin_user_id, current_year, current_quarter, 0, v.tags,
    v.description, australis_tenant_id
  from (values
    ('Australis onboarding and human profile foundation', 'Build enough onboarding for hello@australis.cloud to become the first normal Australis business-manager user with role, goals, preferences, source permissions, and voice/text settings.', array['australis','onboarding','human-profile']),
    ('BOH billing, Patron CRM, and entitlement foundation', 'Make BOH the source of truth for Australis/BOH customer CRM, Stripe billing, product entitlements, packages, and provisioning events.', array['boh','billing','patron','entitlements']),
    ('Daily Briefing and Work Sessions foundation', 'Create goal-aware Daily Briefing storage/scheduling and structured Work Sessions for agent execution, evidence, blockers, approvals, and outputs.', array['australis','briefing','work-sessions']),
    ('Australis Voice, chat, and Hermes model routing', 'Implement response preferences, contextual/standalone voice-chat, local model routing, confidence checks, and external model escalation policy.', array['australis','voice','hermes','model-routing']),
    ('BOH adapters and future Australis agent orchestration', 'Connect Australis to BOH operating sources and define future Australis business-manager/product agent review, assignment, and update workflows across Menu, Forge, Counter, Tablez/Chairz, and agents after hello@australis.cloud onboarding creates the Australis agent team.', array['boh-adapter','australis-agents','forge','menu']),
    ('3D Workroom and Context Graph foundation', 'Establish enterprise visual workroom and governed memory/context graph foundations after Work Session data exists.', array['australis','3d-workroom','context-graph']),
    ('Commercial pipeline, Cookbook, Funnel, and marketing asset loop', 'Enable the autonomous Australis business unit to market and sell Australis/BOH through Patron, Funnel, Cookbook, campaigns, and pipeline assets.', array['commercial','cookbook','funnel','patron'])
  ) as v(title, description, tags)
  where not exists (
    select 1 from public.boh_initiative i
    where i.tenant_id = australis_tenant_id and i.title = v.title
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
  and i.title in (
    'Bootstrap Australis autonomous business foundation',
    'Australis onboarding and human profile foundation',
    'BOH billing, Patron CRM, and entitlement foundation',
    'Daily Briefing and Work Sessions foundation',
    'Australis Voice, chat, and Hermes model routing',
    'BOH adapters and future Australis agent orchestration',
    '3D Workroom and Context Graph foundation',
    'Commercial pipeline, Cookbook, Funnel, and marketing asset loop'
  )
order by case i.title
  when 'Bootstrap Australis autonomous business foundation' then 1
  when 'Australis onboarding and human profile foundation' then 2
  when 'BOH billing, Patron CRM, and entitlement foundation' then 3
  when 'Daily Briefing and Work Sessions foundation' then 4
  when 'Australis Voice, chat, and Hermes model routing' then 5
  when 'BOH adapters and future Australis agent orchestration' then 6
  when 'Commercial pipeline, Cookbook, Funnel, and marketing asset loop' then 7
  when '3D Workroom and Context Graph foundation' then 8
  else 99
end;
