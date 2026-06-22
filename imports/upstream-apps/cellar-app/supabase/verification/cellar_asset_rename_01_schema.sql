-- CELLAR asset rename 01/03: schema names.
do $$
begin
  if to_regclass('public.cellar_assets') is null and to_regclass('public.cellar_materials') is not null then
    alter table public.cellar_materials rename to cellar_assets;
  end if;
  if to_regclass('public.cellar_asset_access_requests') is null and to_regclass('public.cellar_material_access_requests') is not null then
    alter table public.cellar_material_access_requests rename to cellar_asset_access_requests;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_assets' and column_name = 'material_type') then
    alter table public.cellar_assets rename column material_type to asset_type;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_assets' and column_name = 'parent_material_id') then
    alter table public.cellar_assets rename column parent_material_id to parent_asset_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_asset_access_requests' and column_name = 'material_id') then
    alter table public.cellar_asset_access_requests rename column material_id to asset_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_prepared_qa' and column_name = 'related_material_id') then
    alter table public.cellar_prepared_qa rename column related_material_id to related_asset_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_investor_questions' and column_name = 'related_material_id') then
    alter table public.cellar_investor_questions rename column related_material_id to related_asset_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_investor_notes' and column_name = 'material_id') then
    alter table public.cellar_investor_notes rename column material_id to asset_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cellar_activity_events' and column_name = 'material_id') then
    alter table public.cellar_activity_events rename column material_id to asset_id;
  end if;
end $$;

alter index if exists cellar_materials_presentation_status_idx rename to cellar_assets_presentation_status_idx;
alter index if exists cellar_materials_parent_material_id_idx rename to cellar_assets_parent_asset_id_idx;
alter index if exists cellar_materials_investor_kb_source_id_idx rename to cellar_assets_investor_kb_source_id_idx;
alter index if exists cellar_material_access_requests_investor_idx rename to cellar_asset_access_requests_investor_idx;
alter index if exists cellar_investor_notes_material_idx rename to cellar_investor_notes_asset_idx;
