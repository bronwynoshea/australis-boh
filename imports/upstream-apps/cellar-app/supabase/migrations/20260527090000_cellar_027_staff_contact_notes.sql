-- CELLAR staff-only investor contact notes.
create table if not exists public.cellar_staff_contact_notes (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  note_body text not null,
  created_by_boh_user_id text not null default cellar_private.current_boh_user_id(),
  updated_by_boh_user_id text not null default cellar_private.current_boh_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cellar_staff_contact_notes_body_not_blank check (length(trim(note_body)) > 0)
);

comment on table public.cellar_staff_contact_notes is
  'CELLAR staff-only notes about investor contacts. Separate from investor presentation notes.';

create index if not exists cellar_staff_contact_notes_investor_idx
  on public.cellar_staff_contact_notes (investor_access_id, created_at desc);

drop trigger if exists cellar_staff_contact_notes_touch_updated_at on public.cellar_staff_contact_notes;
create trigger cellar_staff_contact_notes_touch_updated_at
  before update on public.cellar_staff_contact_notes
  for each row execute function public.cellar_touch_updated_at();

alter table public.cellar_staff_contact_notes enable row level security;

drop policy if exists cellar_staff_contact_notes_staff_read on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_read on public.cellar_staff_contact_notes
  for select using (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_staff_contact_notes_staff_insert on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_insert on public.cellar_staff_contact_notes
  for insert with check (
    cellar_private.current_boh_user_id() is not null
    and created_by_boh_user_id = cellar_private.current_boh_user_id()
    and updated_by_boh_user_id = cellar_private.current_boh_user_id()
  );

drop policy if exists cellar_staff_contact_notes_staff_update on public.cellar_staff_contact_notes;
create policy cellar_staff_contact_notes_staff_update on public.cellar_staff_contact_notes
  for update using (cellar_private.current_boh_user_id() is not null)
  with check (
    cellar_private.current_boh_user_id() is not null
    and updated_by_boh_user_id = cellar_private.current_boh_user_id()
  );
