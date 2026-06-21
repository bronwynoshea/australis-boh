-- BOH Central Command agent engagement support.
-- Local/staging migration only; production promotion remains human-gated.

create table if not exists public.forge_agent_engagement_type (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.forge_agent_engagement_status (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.forge_agent_capability (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.boh_task_status (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.boh_task
  add column if not exists agent_engagement_type_id uuid references public.forge_agent_engagement_type(id),
  add column if not exists agent_engagement_status_id uuid references public.forge_agent_engagement_status(id),
  add column if not exists agent_capability_id uuid references public.forge_agent_capability(id),
  add column if not exists agent_readiness_notes text,
  add column if not exists agent_ready_at timestamptz;

create index if not exists idx_boh_task_agent_engagement_status_id
  on public.boh_task(agent_engagement_status_id);

create index if not exists idx_boh_task_agent_engagement_type_id
  on public.boh_task(agent_engagement_type_id);

create index if not exists idx_boh_task_agent_capability_id
  on public.boh_task(agent_capability_id);

insert into public.forge_agent_engagement_type (key, label, description, sort_order)
values
  ('human_only', 'Human only', 'Requires a live coder or human operator.', 10),
  ('agent_assisted', 'Agent assisted', 'An agent can prepare part of the work for human review.', 20),
  ('agent_ready', 'Agent ready', 'Clear enough for an agent to attempt the implementation.', 30),
  ('review_only', 'Review only', 'Agent or human review task after implementation.', 40)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.forge_agent_engagement_status (key, label, description, sort_order)
values
  ('needs_triage', 'Needs triage', 'Central Command has not assessed this task yet.', 10),
  ('needs_context', 'Needs context', 'The task needs clearer acceptance criteria, files, access, or release context.', 20),
  ('ready_for_agent', 'Ready for agent', 'The task has enough context for agent-assisted work.', 30),
  ('with_agent', 'With agent', 'Agent-assisted work is currently in progress.', 40),
  ('needs_human_review', 'Needs human review', 'Agent output or implementation needs human review.', 50),
  ('ready_for_release_gate', 'Ready for release gate', 'Task is complete enough for release readiness checks.', 60)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.forge_agent_capability (key, label, description, sort_order)
values
  ('frontend_ui', 'Frontend UI', 'React, layout, forms, theme, and interaction work.', 10),
  ('backend_api', 'Backend/API', 'Supabase queries, Edge Functions, and API integration work.', 20),
  ('database_rls', 'Database/RLS', 'Migrations, policies, grants, and data integrity checks.', 30),
  ('testing_verification', 'Testing/verification', 'Typecheck, smoke testing, acceptance checks, and regression review.', 40),
  ('documentation_release', 'Documentation/release', 'Ledger, release notes, workflow docs, and handoff packets.', 50),
  ('unknown', 'Unknown', 'Capability still needs assessment.', 60)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.boh_task_status (key, label, description, sort_order)
values
  ('not_started', 'Not started', 'Work has not started.', 10),
  ('in_progress', 'In progress', 'Work is actively underway.', 20),
  ('blocked', 'Blocked', 'Work cannot continue until a blocker is removed.', 30),
  ('review', 'Review', 'Work is ready for review.', 40),
  ('done', 'Done', 'Work is complete.', 50)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

alter table public.forge_agent_engagement_type enable row level security;
alter table public.forge_agent_engagement_status enable row level security;
alter table public.forge_agent_capability enable row level security;
alter table public.boh_task_status enable row level security;

drop policy if exists "forge_agent_engagement_type_select_authenticated" on public.forge_agent_engagement_type;
create policy "forge_agent_engagement_type_select_authenticated"
  on public.forge_agent_engagement_type
  for select
  to authenticated
  using (true);

drop policy if exists "forge_agent_engagement_status_select_authenticated" on public.forge_agent_engagement_status;
create policy "forge_agent_engagement_status_select_authenticated"
  on public.forge_agent_engagement_status
  for select
  to authenticated
  using (true);

drop policy if exists "forge_agent_capability_select_authenticated" on public.forge_agent_capability;
create policy "forge_agent_capability_select_authenticated"
  on public.forge_agent_capability
  for select
  to authenticated
  using (true);

drop policy if exists "boh_task_status_select_authenticated" on public.boh_task_status;
create policy "boh_task_status_select_authenticated"
  on public.boh_task_status
  for select
  to authenticated
  using (true);
