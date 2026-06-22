-- CELLAR pitch-room material metadata and private storage bucket.
create table if not exists public.cellar_presentations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by_boh_user_id text,
  updated_by_boh_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cellar_presentations is 'CELLAR investor pitch-room presentation containers.';
create index if not exists cellar_presentations_status_sort_idx on public.cellar_presentations (status, sort_order, published_at desc);
drop trigger if exists cellar_presentations_touch_updated_at on public.cellar_presentations;
create trigger cellar_presentations_touch_updated_at before update on public.cellar_presentations for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_materials (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid references public.cellar_presentations(id) on delete set null,
  title text not null,
  material_type text not null check (material_type in ('deck', 'slide', 'video', 'video_set', 'document', 'document_list', 'locked_material', 'link')),
  visibility text not null default 'guest' check (visibility in ('guest', 'verified', 'appendix_granted', 'staff_only')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  tab_label text,
  summary text,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds integer,
  slide_number integer,
  parent_material_id uuid references public.cellar_materials(id) on delete set null,
  investor_kb_source_id text,
  investor_kb_scope text not null default 'investor_kb' check (investor_kb_scope = 'investor_kb'),
  founder_narrative text,
  staff_notes text,
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by_boh_user_id text,
  updated_by_boh_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cellar_materials is 'CELLAR investor-facing materials for decks, videos, documents, links, and locked materials. Investor KB scope only.';
comment on column public.cellar_materials.storage_bucket is 'Expected private bucket: cellar_investor_materials.';
create index if not exists cellar_materials_presentation_status_idx on public.cellar_materials (presentation_id, status, visibility, sort_order);
create index if not exists cellar_materials_parent_material_id_idx on public.cellar_materials (parent_material_id, sort_order);
create index if not exists cellar_materials_investor_kb_source_id_idx on public.cellar_materials (investor_kb_source_id);
drop trigger if exists cellar_materials_touch_updated_at on public.cellar_materials;
create trigger cellar_materials_touch_updated_at before update on public.cellar_materials for each row execute function public.cellar_touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cellar_investor_materials', 'cellar_investor_materials', false, 104857600,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
