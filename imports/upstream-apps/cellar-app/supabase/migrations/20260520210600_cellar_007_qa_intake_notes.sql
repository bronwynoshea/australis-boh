-- CELLAR prepared Q&A, investor intake, and verified investor notes.
create table if not exists public.cellar_material_access_requests (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  material_id uuid references public.cellar_materials(id) on delete set null,
  request_status text not null default 'requested' check (request_status in ('requested', 'approved', 'denied', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_boh_user_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cellar_material_access_requests is 'CELLAR appendix/deeper-material requests tied to one investor access record.';
create index if not exists cellar_material_access_requests_investor_idx on public.cellar_material_access_requests (investor_access_id, request_status, requested_at desc);
drop trigger if exists cellar_material_access_requests_touch_updated_at on public.cellar_material_access_requests;
create trigger cellar_material_access_requests_touch_updated_at before update on public.cellar_material_access_requests for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_prepared_qa (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  topic text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'guest' check (visibility in ('guest', 'verified', 'appendix_granted', 'staff_only')),
  related_material_id uuid references public.cellar_materials(id) on delete set null,
  related_slide_key text,
  investor_kb_source_id text,
  investor_kb_scope text not null default 'investor_kb' check (investor_kb_scope = 'investor_kb'),
  sort_order integer not null default 0,
  published_at timestamptz,
  created_by_boh_user_id text,
  updated_by_boh_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cellar_prepared_qa is 'CELLAR prepared investor Q&A. Investor-facing provenance must stay scoped to Investor KB.';
create index if not exists cellar_prepared_qa_status_topic_idx on public.cellar_prepared_qa (status, topic, sort_order);
create index if not exists cellar_prepared_qa_search_idx on public.cellar_prepared_qa using gin (to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' || coalesce(topic, '')));
drop trigger if exists cellar_prepared_qa_touch_updated_at on public.cellar_prepared_qa;
create trigger cellar_prepared_qa_touch_updated_at before update on public.cellar_prepared_qa for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_investor_questions (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid references public.cellar_investor_access(id) on delete set null,
  investor_session_id uuid references public.cellar_investor_sessions(id) on delete set null,
  related_material_id uuid references public.cellar_materials(id) on delete set null,
  question text not null,
  status text not null default 'new' check (status in ('new', 'triaged', 'answered', 'closed')),
  staff_answer text,
  answered_by_boh_user_id text,
  answered_at timestamptz,
  promoted_prepared_qa_id uuid references public.cellar_prepared_qa(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.cellar_investor_questions is 'CELLAR investor question intake linked to investor access/session and prepared Q&A promotion.';
create index if not exists cellar_investor_questions_investor_idx on public.cellar_investor_questions (investor_access_id, status, created_at desc);
drop trigger if exists cellar_investor_questions_touch_updated_at on public.cellar_investor_questions;
create trigger cellar_investor_questions_touch_updated_at before update on public.cellar_investor_questions for each row execute function public.cellar_touch_updated_at();

create table if not exists public.cellar_investor_notes (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  material_id uuid references public.cellar_materials(id) on delete set null,
  slide_key text,
  note_body text not null,
  visibility text not null default 'private' check (visibility in ('private', 'shared_with_staff')),
  saved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
