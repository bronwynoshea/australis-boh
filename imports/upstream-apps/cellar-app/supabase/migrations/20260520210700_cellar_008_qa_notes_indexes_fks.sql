-- CELLAR follow-on indexes and additive FK links for Q&A/material activity.
comment on table public.cellar_investor_notes is
  'CELLAR verified investor saved notes linked to investor access and optional material/slide context.';

create index if not exists cellar_investor_notes_investor_idx
  on public.cellar_investor_notes (investor_access_id, saved_at desc);
create index if not exists cellar_investor_notes_material_idx
  on public.cellar_investor_notes (material_id, slide_key);

drop trigger if exists cellar_investor_notes_touch_updated_at on public.cellar_investor_notes;
create trigger cellar_investor_notes_touch_updated_at
  before update on public.cellar_investor_notes
  for each row execute function public.cellar_touch_updated_at();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cellar_activity_events_material_id_fkey') then
    alter table public.cellar_activity_events
      add constraint cellar_activity_events_material_id_fkey
      foreign key (material_id) references public.cellar_materials(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cellar_activity_events_prepared_qa_id_fkey') then
    alter table public.cellar_activity_events
      add constraint cellar_activity_events_prepared_qa_id_fkey
      foreign key (prepared_qa_id) references public.cellar_prepared_qa(id) on delete set null;
  end if;
end $$;
