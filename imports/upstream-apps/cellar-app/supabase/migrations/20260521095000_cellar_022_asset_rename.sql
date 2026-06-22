-- CELLAR asset naming migration.
-- Moves the live presentation content model from "materials" wording to "assets".

do $$
begin
  if to_regclass('public.cellar_assets') is null and to_regclass('public.cellar_materials') is not null then
    alter table public.cellar_materials rename to cellar_assets;
  end if;

  if to_regclass('public.cellar_asset_access_requests') is null and to_regclass('public.cellar_material_access_requests') is not null then
    alter table public.cellar_material_access_requests rename to cellar_asset_access_requests;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_assets' and column_name = 'material_type'
  ) then
    alter table public.cellar_assets rename column material_type to asset_type;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_assets' and column_name = 'parent_material_id'
  ) then
    alter table public.cellar_assets rename column parent_material_id to parent_asset_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_asset_access_requests' and column_name = 'material_id'
  ) then
    alter table public.cellar_asset_access_requests rename column material_id to asset_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_prepared_qa' and column_name = 'related_material_id'
  ) then
    alter table public.cellar_prepared_qa rename column related_material_id to related_asset_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_investor_questions' and column_name = 'related_material_id'
  ) then
    alter table public.cellar_investor_questions rename column related_material_id to related_asset_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_investor_notes' and column_name = 'material_id'
  ) then
    alter table public.cellar_investor_notes rename column material_id to asset_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cellar_activity_events' and column_name = 'material_id'
  ) then
    alter table public.cellar_activity_events rename column material_id to asset_id;
  end if;
end $$;

alter index if exists cellar_materials_presentation_status_idx rename to cellar_assets_presentation_status_idx;
alter index if exists cellar_materials_parent_material_id_idx rename to cellar_assets_parent_asset_id_idx;
alter index if exists cellar_materials_investor_kb_source_id_idx rename to cellar_assets_investor_kb_source_id_idx;
alter index if exists cellar_material_access_requests_investor_idx rename to cellar_asset_access_requests_investor_idx;
alter index if exists cellar_investor_notes_material_idx rename to cellar_investor_notes_asset_idx;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'cellar_materials_pkey'
      and conrelid = 'public.cellar_assets'::regclass
  ) then
    alter table public.cellar_assets rename constraint cellar_materials_pkey to cellar_assets_pkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'cellar_material_access_requests_pkey'
      and conrelid = 'public.cellar_asset_access_requests'::regclass
  ) then
    alter table public.cellar_asset_access_requests rename constraint cellar_material_access_requests_pkey to cellar_asset_access_requests_pkey;
  end if;
end $$;

drop trigger if exists cellar_materials_touch_updated_at on public.cellar_assets;
drop trigger if exists cellar_asset_touch_updated_at on public.cellar_assets;
create trigger cellar_assets_touch_updated_at
  before update on public.cellar_assets
  for each row execute function public.cellar_touch_updated_at();

drop trigger if exists cellar_material_access_requests_touch_updated_at on public.cellar_asset_access_requests;
drop trigger if exists cellar_asset_access_request_touch_updated_at on public.cellar_asset_access_requests;
create trigger cellar_asset_access_requests_touch_updated_at
  before update on public.cellar_asset_access_requests
  for each row execute function public.cellar_touch_updated_at();

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cellar_assets' and policyname = 'cellar_materials_staff_all'
  ) then
    alter policy cellar_materials_staff_all on public.cellar_assets rename to cellar_assets_staff_all;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cellar_assets' and policyname = 'cellar_materials_verified_read_published'
  ) then
    alter policy cellar_materials_verified_read_published on public.cellar_assets rename to cellar_assets_verified_read_published;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cellar_asset_access_requests' and policyname = 'cellar_material_access_requests_staff_all'
  ) then
    alter policy cellar_material_access_requests_staff_all on public.cellar_asset_access_requests rename to cellar_asset_access_requests_staff_all;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cellar_asset_access_requests' and policyname = 'cellar_material_access_requests_verified_self_read'
  ) then
    alter policy cellar_material_access_requests_verified_self_read on public.cellar_asset_access_requests rename to cellar_asset_access_requests_verified_self_read;
  end if;
end $$;

comment on table public.cellar_assets is 'CELLAR investor-facing assets for decks, videos, documents, links, and locked assets. Investor KB scope only.';
comment on column public.cellar_assets.storage_bucket is 'Expected private bucket for new uploads: cellar_investor_assets. Existing rows may retain cellar_investor_materials until files are moved.';
comment on table public.cellar_asset_access_requests is 'CELLAR appendix/deeper-asset requests tied to one investor access record.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cellar_investor_assets', 'cellar_investor_assets', false, 104857600,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop function if exists public.cellar_search_prepared_qa(text, integer, uuid);
create function public.cellar_search_prepared_qa(p_query text, p_limit integer default 10, p_session_id uuid default null)
returns table(id uuid, question text, answer text, topic text, related_asset_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select cpq.id, cpq.question, cpq.answer, cpq.topic, cpq.related_asset_id
  from public.cellar_prepared_qa as cpq
  where cpq.status = 'published'
    and cpq.investor_kb_scope = 'investor_kb'
    and (
      (cpq.visibility = 'guest'
      and (
        public.cellar_has_verified_investor_access()
        or exists (
          select 1 from public.cellar_investor_sessions cis
          where cis.id = p_session_id
            and cis.session_kind = 'guest_code'
            and (cis.expires_at is null or cis.expires_at > now())
        )
      ))
      or (cpq.visibility = 'verified' and public.cellar_has_verified_investor_access())
      or (cpq.visibility = 'appendix_granted' and public.cellar_current_investor_access_status() = 'appendix_granted')
    )
    and to_tsvector('english', coalesce(cpq.question, '') || ' ' || coalesce(cpq.answer, '') || ' ' || coalesce(cpq.topic, ''))
      @@ plainto_tsquery('english', coalesce(p_query, ''))
  order by cpq.sort_order, cpq.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 10), 1), 25)
$$;

drop function if exists public.cellar_create_investor_question(uuid, text, uuid);
create function public.cellar_create_investor_question(p_investor_access_id uuid, p_question text, p_asset_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_question_id uuid;
begin
  if not public.cellar_is_verified_investor(p_investor_access_id) then
    raise exception 'CELLAR_INVESTOR_ACCESS_REQUIRED' using errcode = '28000';
  end if;
  insert into public.cellar_investor_questions (investor_access_id, related_asset_id, question)
  values (p_investor_access_id, p_asset_id, p_question)
  returning id into cellar_question_id;
  return cellar_question_id;
end;
$$;

revoke execute on function public.cellar_search_prepared_qa(text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.cellar_create_investor_question(uuid, text, uuid) from public, anon, authenticated;
