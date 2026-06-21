-- BOH multi-tenant foundation.
--
-- This is the first additive migration for turning BOH into a tenant-scoped
-- business-in-a-box suite. It intentionally does not remove existing app_context
-- filters yet; app_context remains a compatibility boundary while tenant_id is
-- backfilled and application code is moved over in later checkpoints.

begin;

create table if not exists public.boh_tenant (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended', 'archived')),
  app_context text not null default 'boh',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.boh_tenant is
  'Tenant/business using the BOH Suite. JOBZCAFE is the first/default tenant.';

create table if not exists public.boh_tenant_member (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  user_id uuid not null references public.boh_user(id) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('active', 'invited', 'inactive', 'removed')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

comment on table public.boh_tenant_member is
  'Connects BOH users to the tenants/businesses they can access.';

create table if not exists public.boh_tenant_app (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  app_id uuid not null references public.boh_app(id) on delete cascade,
  status text not null default 'enabled' check (status in ('enabled', 'disabled', 'trial', 'coming_soon', 'archived')),
  app_kind text not null default 'boh' check (app_kind in ('boh', 'external')),
  display_name text,
  launch_route text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, app_id)
);

comment on table public.boh_tenant_app is
  'Per-tenant app/module enablement for BOH Suite modules and JOBZCAFE dashboard-launch external apps.';

create index if not exists boh_tenant_slug_idx on public.boh_tenant(slug);
create index if not exists boh_tenant_member_user_id_idx on public.boh_tenant_member(user_id);
create index if not exists boh_tenant_app_tenant_id_idx on public.boh_tenant_app(tenant_id);
create index if not exists boh_tenant_app_app_id_idx on public.boh_tenant_app(app_id);

insert into public.boh_tenant (slug, name, legal_name, status, app_context, metadata)
values (
  'jobzcafe',
  'JOBZCAFE®',
  'JOBZCAFE',
  'active',
  'boh',
  jsonb_build_object('default_tenant', true, 'tenant_type', 'internal_reference')
)
on conflict (slug) do update
set name = excluded.name,
    legal_name = excluded.legal_name,
    status = 'active',
    app_context = 'boh',
    metadata = public.boh_tenant.metadata || excluded.metadata,
    updated_at = now();

-- Register the new BOH Suite modules that are not built yet but should exist as
-- tenant-selectable capabilities. These are intentionally marked active so they
-- can be configured/permissioned, while tenant_app.status marks them coming_soon.
insert into public.boh_app (
  id,
  name,
  slug,
  description,
  route,
  external_url,
  primary_color,
  type,
  is_active,
  app_context,
  created_at
)
values
  (gen_random_uuid(), 'Assembly', 'assembly', 'Memos, meetings, decisions, reviews, and governance', '/assembly', null, null, 'internal_tool', true, 'boh', now()),
  (gen_random_uuid(), 'Funnel', 'funnel', 'Campaigns, journeys, demand generation, and conversion handoffs', '/funnel', null, null, 'internal_tool', true, 'boh', now()),
  (gen_random_uuid(), 'Wiki', 'wiki', 'Shared company knowledge base and JOBZCAFE® second brain', '/wiki', null, null, 'internal_tool', true, 'boh', now())
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    route = excluded.route,
    type = excluded.type,
    is_active = true,
    app_context = 'boh';

-- Keep the backend/app id simple as tablez, while allowing the front end to show
-- the product copy as “Tablez and Chairz”.
update public.boh_app
set name = 'Tablez and Chairz'
where slug = 'tablez';

-- Seed JOBZCAFE tenant membership from existing BOH users.
insert into public.boh_tenant_member (tenant_id, user_id, membership_status, is_default)
select t.id, u.id, 'active', true
from public.boh_tenant t
join public.boh_user u on u.app_context = 'boh'
where t.slug = 'jobzcafe'
on conflict (tenant_id, user_id) do update
set membership_status = excluded.membership_status,
    is_default = true,
    updated_at = now();

-- Seed JOBZCAFE app enablement from the existing app registry, while recording
-- the intended suite/external/hybrid split. Central is now Australis, so it is
-- not enabled as a BOH Suite module for the JOBZCAFE tenant in this mapping.
insert into public.boh_tenant_app (
  tenant_id,
  app_id,
  status,
  app_kind,
  display_name,
  launch_route,
  external_url,
  metadata
)
select
  t.id,
  a.id,
  case
    when a.slug in ('assembly', 'funnel', 'wiki') then 'coming_soon'
    else 'enabled'
  end as status,
  case
    when a.slug in ('studio', 'talent', 'website', 'coach', 'mentor', 'journey', 'cafe', 'dna') then 'external'
    else 'boh'
  end as app_kind,
  case when a.slug = 'tablez' then 'Tablez and Chairz' else a.name end as display_name,
  a.route,
  a.external_url,
  case
    when a.slug = 'loft' then jsonb_build_object('note', 'Loft currently lives in the JOBZCAFE project but belongs in BOH like Slotz; move code later.')
    when a.slug in ('studio', 'talent', 'website', 'coach', 'mentor', 'journey', 'cafe', 'dna') then jsonb_build_object('note', 'External JOBZCAFE dashboard-launch app, not a core BOH Suite module.')
    else '{}'::jsonb
  end as metadata
from public.boh_tenant t
join public.boh_app a on true
where t.slug = 'jobzcafe'
  and a.is_active = true
  and a.slug <> 'central'
on conflict (tenant_id, app_id) do update
set status = excluded.status,
    app_kind = excluded.app_kind,
    display_name = excluded.display_name,
    launch_route = excluded.launch_route,
    external_url = excluded.external_url,
    metadata = public.boh_tenant_app.metadata || excluded.metadata,
    updated_at = now();

-- Add tenant_id to existing identity/access tables first.
alter table public.boh_user add column if not exists tenant_id uuid references public.boh_tenant(id);
alter table public.boh_user_role add column if not exists tenant_id uuid references public.boh_tenant(id);
alter table public.boh_user_app add column if not exists tenant_id uuid references public.boh_tenant(id);

update public.boh_user u
set tenant_id = t.id
from public.boh_tenant t
where t.slug = 'jobzcafe'
  and u.tenant_id is null
  and u.app_context = 'boh';

update public.boh_user_role r
set tenant_id = coalesce((select u.tenant_id from public.boh_user u where u.id = r.user_id), t.id)
from public.boh_tenant t
where t.slug = 'jobzcafe'
  and r.tenant_id is null
  and r.app_context = 'boh';

update public.boh_user_app ua
set tenant_id = coalesce((select u.tenant_id from public.boh_user u where u.id = ua.user_id), t.id)
from public.boh_tenant t
where t.slug = 'jobzcafe'
  and ua.tenant_id is null
  and ua.app_context = 'boh';

create index if not exists boh_user_tenant_id_idx on public.boh_user(tenant_id);
create index if not exists boh_user_role_tenant_id_idx on public.boh_user_role(tenant_id);
create index if not exists boh_user_app_tenant_id_idx on public.boh_user_app(tenant_id);

-- Add tenant_id to the main operational tables that currently carry BOH Suite
-- records. This is intentionally dynamic so the migration can run safely across
-- BOH-dev/prod shape differences while still backfilling every table that exists.
do $$
declare
  jobzcafe_tenant_id uuid;
  target_table text;
  tenant_tables text[] := array[
    'boh_invite',
    'boh_change_request',
    'boh_conversation',
    'boh_conversation_member',
    'boh_message',
    'boh_quarter_calendar',
    'boh_initiative',
    'boh_initiative_release',
    'boh_initiative_forge_status',
    'boh_initiative_planning_stage',
    'boh_initiative_status',
    'boh_release_version',
    'boh_workstream',
    'boh_workstream_approval',
    'boh_workstream_status',
    'boh_user_story',
    'boh_user_story_event',
    'boh_task',
    'boh_task_comment',
    'counter_ticket',
    'counter_ticket_comment',
    'tablez_project',
    'tablez_task',
    'boh_section',
    'boh_table',
    'boh_chair',
    'keep_file',
    'keep_quick_link',
    'keep_user_access',
    'keep_whiteboard_item',
    'keep_whiteboard_card',
    'content_projects',
    'content_sections',
    'content_draft',
    'content_exchanges',
    'content_blueprint',
    'patron_person',
    'patron_organisation',
    'patron_activity',
    'patron_lookup',
    'patron_custom_field',
    'patron_organisation_field_value',
    'patron_organisation_tag',
    'patron_person_field_value',
    'patron_person_organisation',
    'patron_person_persona',
    'patron_person_tag',
    'patron_person_type',
    'patron_persona',
    'patron_pipeline_stage',
    'patron_recruiter_intake',
    'patron_tag',
    'counter_app_area',
    'counter_ticket_priority',
    'counter_ticket_status',
    'scheduling_availability_rules',
    'scheduling_blackout_dates',
    'scheduling_bookings',
    'scheduling_email_events',
    'scheduling_meeting_types',
    'scheduling_reminder_jobs',
    'scheduling_shared_calendar_owners',
    'scheduling_staff_profiles',
    'google_oauth_tokens',
    'outlook_oauth_tokens',
    'google_calendar_sync',
    'outlook_calendar_sync',
    'outlook_synced_events',
    'tablez_chair',
    'tablez_chair_assignment_history',
    'tablez_chair_move_request',
    'tablez_chair_role',
    'tablez_project_status',
    'tablez_section',
    'tablez_table',
    'tablez_task_dependency',
    'tablez_task_priority',
    'tablez_task_status',
    'keep_activity',
    'keep_file_activity',
    'keep_file_approval',
    'keep_file_version',
    'keep_folder',
    'forge_walkthrough_artifact',
    'forge_walkthrough_recipe',
    'forge_walkthrough_run',
    'cellar_activity_events',
    'cellar_asset_access_requests',
    'cellar_assets',
    'cellar_booking_link_audits',
    'cellar_guest_access_codes',
    'cellar_investor_access',
    'cellar_investor_notes',
    'cellar_investor_profiles',
    'cellar_investor_questions',
    'cellar_investor_sessions',
    'cellar_message_threads',
    'cellar_messages',
    'cellar_prepared_qa',
    'cellar_presentations',
    'cellar_staff_contact_notes',
    'cellar_staff_visibility_permissions',
    'cellar_team_members',
    'ai_personas',
    'ai_knowledge_packs',
    'ai_knowledge_items',
    'ai_persona_knowledge_packs',
    'boh_campaign_banner',
    'boh_campaign_bonus_tier',
    'soundbyte_profiles',
    'soundbyte_profile_audiences'
  ];
begin
  select id into jobzcafe_tenant_id from public.boh_tenant where slug = 'jobzcafe';

  foreach target_table in array tenant_tables loop
    if exists (
      select 1
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_name = target_table
        and t.table_type = 'BASE TABLE'
    ) then
      execute format('alter table public.%I add column if not exists tenant_id uuid references public.boh_tenant(id)', target_table);
      execute format('update public.%I set tenant_id = $1 where tenant_id is null', target_table) using jobzcafe_tenant_id;
      execute format('create index if not exists %I on public.%I(tenant_id)', target_table || '_tenant_id_idx', target_table);
      execute format('alter table public.%I alter column tenant_id set not null', target_table);
    end if;
  end loop;
end $$;

-- Now that existing rows are backfilled, require tenant_id for BOH identity and
-- access records going forward.
alter table public.boh_user alter column tenant_id set not null;
alter table public.boh_user_role alter column tenant_id set not null;
alter table public.boh_user_app alter column tenant_id set not null;

create or replace function public.current_boh_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bu.tenant_id
  from public.boh_user bu
  where bu.auth_user_id = (select auth.uid())
    and bu.app_context = 'boh'
  order by bu.created_at asc nulls last
  limit 1
$$;

grant execute on function public.current_boh_tenant_id() to authenticated;

grant select on public.boh_tenant to authenticated;
grant select on public.boh_tenant_member to authenticated;
grant select on public.boh_tenant_app to authenticated;

alter table public.boh_tenant enable row level security;
alter table public.boh_tenant_member enable row level security;
alter table public.boh_tenant_app enable row level security;

drop policy if exists "boh_tenant_select_member_or_admin" on public.boh_tenant;
create policy "boh_tenant_select_member_or_admin"
  on public.boh_tenant
  for select
  to authenticated
  using (
    id = public.current_boh_tenant_id()
    or public.is_boh_super_admin()
  );

drop policy if exists "boh_tenant_member_select_self_or_admin" on public.boh_tenant_member;
create policy "boh_tenant_member_select_self_or_admin"
  on public.boh_tenant_member
  for select
  to authenticated
  using (
    tenant_id = public.current_boh_tenant_id()
    or user_id = public.current_boh_user_id()
    or public.is_boh_super_admin()
  );

drop policy if exists "boh_tenant_app_select_member_or_admin" on public.boh_tenant_app;
create policy "boh_tenant_app_select_member_or_admin"
  on public.boh_tenant_app
  for select
  to authenticated
  using (
    tenant_id = public.current_boh_tenant_id()
    or public.is_boh_super_admin()
  );

-- Update bootstrap policies so existing access reads remain compatible while
-- also respecting the current tenant. The OR super-admin path keeps current
-- operators from being locked out during the rollout.
drop policy if exists "boh_user_role_select_bootstrap" on public.boh_user_role;
create policy "boh_user_role_select_bootstrap"
  on public.boh_user_role
  for select
  to authenticated
  using (
    app_context = 'boh'
    and (
      (user_id = public.current_boh_user_id() and tenant_id = public.current_boh_tenant_id())
      or public.is_boh_super_admin()
    )
  );

drop policy if exists "boh_user_app_select_bootstrap" on public.boh_user_app;
create policy "boh_user_app_select_bootstrap"
  on public.boh_user_app
  for select
  to authenticated
  using (
    app_context = 'boh'
    and (
      (user_id = public.current_boh_user_id() and tenant_id = public.current_boh_tenant_id())
      or public.is_boh_super_admin()
    )
  );

commit;
