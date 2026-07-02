begin;

create schema if not exists private;

create or replace function private.current_assembly_boh_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select bu.id
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
    and bu.app_context = 'boh'
    and bu.status = 'active'
  order by bu.created_at asc nulls last
  limit 1;
$$;

create or replace function private.current_assembly_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce(array_agg(distinct bu.tenant_id), '{}'::uuid[])
  from public.boh_user bu
  where bu.auth_user_id = auth.uid()
    and bu.app_context = 'boh'
    and bu.status = 'active'
    and bu.tenant_id is not null;
$$;

create or replace function public.set_assembly_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.assembly_memo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  title text not null,
  what_text text not null,
  how_text text not null,
  now_text text not null,
  requested_decision text,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'accepted', 'deferred', 'closed')),
  memo_type text not null default 'operating' check (memo_type in ('operating', 'governance', 'review')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  author_id uuid references public.boh_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assembly_meeting (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  title text not null,
  meeting_type text not null default 'operating' check (meeting_type in ('operating', 'board', 'shareholder', 'review')),
  scheduled_at timestamptz,
  chair_id uuid references public.boh_user(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'in_session', 'minutes_draft', 'closed')),
  minutes_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assembly_agenda_item (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  meeting_id uuid not null references public.assembly_meeting(id) on delete cascade,
  memo_id uuid not null references public.assembly_memo(id) on delete restrict,
  title text not null,
  purpose text not null default 'discuss' check (purpose in ('inform', 'discuss', 'decide', 'approve', 'resolve', 'defer')),
  sort_order integer not null default 1,
  timebox_minutes integer,
  status text not null default 'planned' check (status in ('planned', 'covered', 'deferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, meeting_id, memo_id)
);

create table if not exists public.assembly_outcome (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  meeting_id uuid references public.assembly_meeting(id) on delete set null,
  agenda_item_id uuid references public.assembly_agenda_item(id) on delete set null,
  memo_id uuid references public.assembly_memo(id) on delete set null,
  title text not null,
  outcome_type text not null default 'action' check (outcome_type in ('action', 'decision', 'approval', 'deferral', 'escalation', 'resolution')),
  summary text not null,
  owner_id uuid references public.boh_user(id) on delete set null,
  due_date date,
  handoff_target text not null default 'none' check (handoff_target in ('tablez', 'menu_review', 'counter', 'patron', 'keep', 'none')),
  handoff_status text not null default 'not_required' check (handoff_status in ('not_required', 'pending', 'sent', 'unavailable')),
  external_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assembly_resolution (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  meeting_id uuid references public.assembly_meeting(id) on delete set null,
  title text not null,
  resolution_type text not null default 'board' check (resolution_type in ('board', 'shareholder', 'written_consent')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'filed')),
  approved_at timestamptz,
  summary text,
  keep_file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assembly_review (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  title text not null,
  cadence text not null check (cadence in ('weekly', 'quarterly', 'annual')),
  period_label text not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'closed')),
  meeting_id uuid references public.assembly_meeting(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assembly_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  meeting_id uuid not null references public.assembly_meeting(id) on delete cascade,
  user_id uuid references public.boh_user(id) on delete set null,
  display_name text,
  role text not null default 'attendee' check (role in ('chair', 'secretary', 'attendee', 'guest')),
  attendance_status text not null default 'expected' check (attendance_status in ('expected', 'present', 'absent', 'excused')),
  created_at timestamptz not null default now(),
  unique (tenant_id, meeting_id, user_id)
);

create table if not exists public.assembly_handoff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  outcome_id uuid not null references public.assembly_outcome(id) on delete cascade,
  target_app text not null check (target_app in ('tablez', 'menu', 'counter', 'patron', 'keep')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'unavailable')),
  external_record_id uuid,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists assembly_memo_tenant_status_idx on public.assembly_memo(tenant_id, status, updated_at desc);
create index if not exists assembly_meeting_tenant_status_idx on public.assembly_meeting(tenant_id, status, scheduled_at);
create index if not exists assembly_agenda_item_meeting_idx on public.assembly_agenda_item(tenant_id, meeting_id, sort_order);
create index if not exists assembly_outcome_tenant_status_idx on public.assembly_outcome(tenant_id, handoff_status, updated_at desc);
create index if not exists assembly_resolution_tenant_idx on public.assembly_resolution(tenant_id, status, updated_at desc);
create index if not exists assembly_review_tenant_idx on public.assembly_review(tenant_id, cadence, status);
create index if not exists assembly_handoff_outcome_idx on public.assembly_handoff(tenant_id, outcome_id, created_at desc);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assembly_memo','assembly_meeting','assembly_agenda_item','assembly_outcome','assembly_resolution','assembly_review'] LOOP
    EXECUTE format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    EXECUTE format('create trigger %I before update on public.%I for each row execute function public.set_assembly_updated_at()', t || '_set_updated_at', t);
  END LOOP;
END $$;

alter table public.assembly_memo enable row level security;
alter table public.assembly_meeting enable row level security;
alter table public.assembly_agenda_item enable row level security;
alter table public.assembly_outcome enable row level security;
alter table public.assembly_resolution enable row level security;
alter table public.assembly_review enable row level security;
alter table public.assembly_attendance enable row level security;
alter table public.assembly_handoff enable row level security;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assembly_memo','assembly_meeting','assembly_agenda_item','assembly_outcome','assembly_resolution','assembly_review','assembly_attendance','assembly_handoff'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', t || '_tenant_select', t);
    EXECUTE format('create policy %I on public.%I for select to authenticated using (tenant_id = any(private.current_assembly_tenant_ids()))', t || '_tenant_select', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_tenant_insert', t);
    EXECUTE format('create policy %I on public.%I for insert to authenticated with check (tenant_id = any(private.current_assembly_tenant_ids()))', t || '_tenant_insert', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_tenant_update', t);
    EXECUTE format('create policy %I on public.%I for update to authenticated using (tenant_id = any(private.current_assembly_tenant_ids())) with check (tenant_id = any(private.current_assembly_tenant_ids()))', t || '_tenant_update', t);
    EXECUTE format('drop policy if exists %I on public.%I', t || '_tenant_delete', t);
    EXECUTE format('create policy %I on public.%I for delete to authenticated using (tenant_id = any(private.current_assembly_tenant_ids()))', t || '_tenant_delete', t);
  END LOOP;
END $$;

grant select, insert, update, delete on public.assembly_memo to authenticated;
grant select, insert, update, delete on public.assembly_meeting to authenticated;
grant select, insert, update, delete on public.assembly_agenda_item to authenticated;
grant select, insert, update, delete on public.assembly_outcome to authenticated;
grant select, insert, update, delete on public.assembly_resolution to authenticated;
grant select, insert, update, delete on public.assembly_review to authenticated;
grant select, insert, update, delete on public.assembly_attendance to authenticated;
grant select, insert, update, delete on public.assembly_handoff to authenticated;

insert into public.boh_app (id, name, slug, description, route, external_url, primary_color, type, is_active, app_context, created_at)
values (gen_random_uuid(), 'Assembly', 'assembly', 'Memos, meetings, decisions, outcomes, governance records, and recurring reviews.', '/assembly', null, null, 'internal_tool', true, 'boh', now())
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    route = excluded.route,
    type = excluded.type,
    is_active = true,
    app_context = 'boh';

insert into public.boh_tenant_app (tenant_id, app_id, status, app_kind, display_name, launch_route, external_url, metadata)
select t.id, a.id, 'enabled', 'boh', 'Assembly', '/assembly', null,
       jsonb_build_object('scope', 'memos, meetings, decisions, outcomes, governance, reviews')
from public.boh_tenant t
join public.boh_app a on a.slug = 'assembly'
on conflict (tenant_id, app_id) do update
set status = 'enabled',
    app_kind = 'boh',
    display_name = 'Assembly',
    launch_route = '/assembly',
    external_url = null,
    metadata = public.boh_tenant_app.metadata || excluded.metadata,
    updated_at = now();

commit;
