alter table public.forge_walkthrough_run
  add column if not exists capture_mode text not null default 'screenshot_scenes';

alter table public.forge_walkthrough_run
  add column if not exists render_mode text not null default 'remotion';

alter table public.forge_walkthrough_run
  add column if not exists voiceover_mode text not null default 'none';

alter table public.forge_walkthrough_run
  add column if not exists step_plan jsonb;

alter table public.forge_walkthrough_run
  add column if not exists transcript_text text;

alter table public.forge_walkthrough_run
  drop constraint if exists forge_walkthrough_run_capture_mode_check;

alter table public.forge_walkthrough_run
  add constraint forge_walkthrough_run_capture_mode_check
  check (capture_mode in ('screenshot_scenes', 'screen_recording'));

alter table public.forge_walkthrough_run
  drop constraint if exists forge_walkthrough_run_render_mode_check;

alter table public.forge_walkthrough_run
  add constraint forge_walkthrough_run_render_mode_check
  check (render_mode in ('remotion', 'raw_recording'));

alter table public.forge_walkthrough_run
  drop constraint if exists forge_walkthrough_run_voiceover_mode_check;

alter table public.forge_walkthrough_run
  add constraint forge_walkthrough_run_voiceover_mode_check
  check (voiceover_mode in ('none', 'transcript', 'voiceover_ready'));

alter table public.forge_walkthrough_artifact
  drop constraint if exists forge_walkthrough_artifact_artifact_type_check;

alter table public.forge_walkthrough_artifact
  add constraint forge_walkthrough_artifact_artifact_type_check
  check (artifact_type in ('video', 'screenshot', 'trace', 'manifest'));

insert into public.forge_walkthrough_asset_template (
  slug,
  name,
  description,
  app_key,
  asset_template_path,
  is_active
)
values (
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
