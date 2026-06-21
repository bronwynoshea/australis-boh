create table if not exists public.forge_walkthrough_asset_template (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  app_key text not null,
  asset_template_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forge_walkthrough_run (
  id uuid primary key default gen_random_uuid(),
  asset_template_id uuid not null references public.forge_walkthrough_asset_template(id),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  requested_by uuid references public.boh_user(id),
  environment text not null default 'dev' check (environment in ('dev', 'staging')),
  capture_mode text not null default 'screenshot_scenes' check (capture_mode in ('screenshot_scenes', 'screen_recording')),
  render_mode text not null default 'remotion' check (render_mode in ('remotion', 'raw_recording')),
  voiceover_mode text not null default 'none' check (voiceover_mode in ('none', 'transcript', 'voiceover_ready')),
  step_plan jsonb,
  transcript_text text,
  target_url text,
  video_storage_bucket text,
  video_storage_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forge_walkthrough_artifact (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.forge_walkthrough_run(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('video', 'screenshot', 'trace', 'manifest')),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_forge_walkthrough_run_asset_template_id
  on public.forge_walkthrough_run(asset_template_id);

create index if not exists idx_forge_walkthrough_run_status_created
  on public.forge_walkthrough_run(status, created_at);

create index if not exists idx_forge_walkthrough_artifact_run_id
  on public.forge_walkthrough_artifact(run_id);

insert into storage.buckets (id, name, public)
values ('forge-walkthrough-artifacts', 'forge-walkthrough-artifacts', false)
on conflict (id) do update set public = false;

insert into public.forge_walkthrough_asset_template (
  slug,
  name,
  description,
  app_key,
  asset_template_path,
  is_active
)
values
(
  'talent-walkthrough-mobile',
  'Talent Mobile Walkthrough',
  'Records a short mobile-first walkthrough of the Talent recruiter workflow.',
  'talent',
  'tools/walkthrough-recorder/asset-templates/talent-walkthrough-mobile.json',
  true
),
(
  'talent-onboarding-mobile',
  'Talent Onboarding Walkthrough',
  'Captures a mobile-first onboarding walkthrough from work email through first-role setup and match preview.',
  'talent',
  'tools/walkthrough-recorder/asset-templates/talent-onboarding-mobile.json',
  true
),
(
  'talent-onboarding-desktop',
  'Talent Onboarding Desktop Walkthrough',
  'Captures a desktop onboarding walkthrough from work email through first-role setup and match preview.',
  'talent',
  'tools/walkthrough-recorder/asset-templates/talent-onboarding-desktop.json',
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  app_key = excluded.app_key,
  asset_template_path = excluded.asset_template_path,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.forge_walkthrough_asset_template enable row level security;
alter table public.forge_walkthrough_run enable row level security;
alter table public.forge_walkthrough_artifact enable row level security;

drop policy if exists "Forge walkthrough asset templates are readable by authenticated users" on public.forge_walkthrough_asset_template;
create policy "Forge walkthrough asset templates are readable by admins"
  on public.forge_walkthrough_asset_template
  for select
  to authenticated
  using (
    is_active = true
    and exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = auth.uid()
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );

drop policy if exists "Forge walkthrough runs are readable by authenticated users" on public.forge_walkthrough_run;
create policy "Forge walkthrough runs are readable by admins"
  on public.forge_walkthrough_run
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = auth.uid()
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );

drop policy if exists "Forge walkthrough artifacts are readable by authenticated users" on public.forge_walkthrough_artifact;
create policy "Forge walkthrough artifacts are readable by admins"
  on public.forge_walkthrough_artifact
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.boh_user bu
      where bu.auth_user_id = auth.uid()
        and (
          bu.primary_role_hint in ('admin', 'super_admin')
          or exists (
            select 1
            from public.boh_user_role bur
            join public.boh_role br on br.id = bur.role_id
            where bur.user_id = bu.id
              and bur.app_context = 'boh'
              and br.code in ('admin', 'super_admin')
          )
        )
    )
  );
