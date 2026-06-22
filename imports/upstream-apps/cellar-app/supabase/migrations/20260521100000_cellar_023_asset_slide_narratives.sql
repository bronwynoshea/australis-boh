alter table public.cellar_assets
  add column if not exists slide_narratives jsonb not null default '{}'::jsonb;

comment on column public.cellar_assets.slide_narratives is
  'CELLAR staff-authored founder narrative keyed by PDF slide number as text. Example: {"1":"Opening narrative"}.';
