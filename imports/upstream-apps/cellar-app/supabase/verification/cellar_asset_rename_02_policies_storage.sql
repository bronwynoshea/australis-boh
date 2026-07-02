-- CELLAR asset rename 02/03: triggers, policies, comments, bucket.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'cellar_materials_pkey' and conrelid = 'public.cellar_assets'::regclass) then
    alter table public.cellar_assets rename constraint cellar_materials_pkey to cellar_assets_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'cellar_material_access_requests_pkey' and conrelid = 'public.cellar_asset_access_requests'::regclass) then
    alter table public.cellar_asset_access_requests rename constraint cellar_material_access_requests_pkey to cellar_asset_access_requests_pkey;
  end if;
end $$;

drop trigger if exists cellar_materials_touch_updated_at on public.cellar_assets;
drop trigger if exists cellar_assets_touch_updated_at on public.cellar_assets;
create trigger cellar_assets_touch_updated_at before update on public.cellar_assets for each row execute function public.cellar_touch_updated_at();

drop trigger if exists cellar_material_access_requests_touch_updated_at on public.cellar_asset_access_requests;
drop trigger if exists cellar_asset_access_requests_touch_updated_at on public.cellar_asset_access_requests;
create trigger cellar_asset_access_requests_touch_updated_at before update on public.cellar_asset_access_requests for each row execute function public.cellar_touch_updated_at();

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cellar_assets' and policyname = 'cellar_materials_staff_all') then
    alter policy cellar_materials_staff_all on public.cellar_assets rename to cellar_assets_staff_all;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cellar_assets' and policyname = 'cellar_materials_verified_read_published') then
    alter policy cellar_materials_verified_read_published on public.cellar_assets rename to cellar_assets_verified_read_published;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cellar_asset_access_requests' and policyname = 'cellar_material_access_requests_staff_all') then
    alter policy cellar_material_access_requests_staff_all on public.cellar_asset_access_requests rename to cellar_asset_access_requests_staff_all;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cellar_asset_access_requests' and policyname = 'cellar_material_access_requests_verified_self_read') then
    alter policy cellar_material_access_requests_verified_self_read on public.cellar_asset_access_requests rename to cellar_asset_access_requests_verified_self_read;
  end if;
end $$;

comment on table public.cellar_assets is 'CELLAR investor-facing assets for decks, videos, documents, links, and locked assets. Investor KB scope only.';
comment on column public.cellar_assets.storage_bucket is 'Expected private bucket for new uploads: cellar_investor_assets. Existing rows may retain cellar_investor_materials until files are moved.';
comment on table public.cellar_asset_access_requests is 'CELLAR appendix/deeper-asset requests tied to one investor access record.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cellar_investor_assets', 'cellar_investor_assets', false, 104857600, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
