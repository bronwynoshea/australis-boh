-- BOH-DEV only. Enables Q&A review cards, guest-visible public answers, and asset source links.
alter table public.cellar_prepared_qa
  drop constraint if exists cellar_prepared_qa_status_check;

alter table public.cellar_prepared_qa
  add constraint cellar_prepared_qa_status_check
  check (status in ('draft', 'needs_review', 'published', 'archived'));

alter table public.cellar_prepared_qa
  add column if not exists related_asset_id uuid;

do $$
begin
  if to_regclass('public.cellar_assets') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'cellar_prepared_qa_related_asset_id_fkey'
        and conrelid = 'public.cellar_prepared_qa'::regclass
    )
  then
    alter table public.cellar_prepared_qa
      add constraint cellar_prepared_qa_related_asset_id_fkey
      foreign key (related_asset_id)
      references public.cellar_assets(id)
      on delete set null;
  end if;
end $$;

drop policy if exists cellar_prepared_qa_guest_read_published on public.cellar_prepared_qa;
create policy cellar_prepared_qa_guest_read_published on public.cellar_prepared_qa
  for select using (
    status = 'published'
    and visibility = 'guest'
    and investor_kb_scope = 'investor_kb'
  );

create index if not exists cellar_prepared_qa_visibility_status_idx
  on public.cellar_prepared_qa (visibility, status, sort_order);
