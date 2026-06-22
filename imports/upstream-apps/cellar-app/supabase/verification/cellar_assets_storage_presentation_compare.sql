-- Read-only CELLAR asset/storage/presentation comparison.
-- Run separately in BOH-DEV and BOH, then compare the result sets.

select
  'presentations' as check_group,
  p.id,
  p.title,
  p.status,
  p.published_at,
  p.sort_order,
  count(a.id) as asset_count
from public.cellar_presentations p
left join public.cellar_assets a on a.presentation_id = p.id
where p.status <> 'archived'
group by p.id, p.title, p.status, p.published_at, p.sort_order
order by p.sort_order, p.published_at desc nulls last, p.title;

select
  'assets' as check_group,
  a.id,
  a.presentation_id,
  a.title,
  a.asset_type,
  a.visibility,
  a.status,
  a.investor_kb_scope,
  a.storage_bucket,
  a.storage_path,
  a.sort_order,
  (
    select count(*)
    from jsonb_each(coalesce(a.slide_narratives, '{}'::jsonb))
  ) as narrative_count
from public.cellar_assets a
where a.status <> 'archived'
order by a.presentation_id nulls first, a.sort_order, a.created_at desc;

select
  'storage_objects' as check_group,
  a.id as asset_id,
  a.title,
  coalesce(a.storage_bucket, 'cellar_investor_assets') as expected_bucket,
  a.storage_path,
  o.id is not null as storage_object_exists,
  o.name as object_name,
  o.metadata->>'size' as object_size,
  o.updated_at as object_updated_at
from public.cellar_assets a
left join storage.objects o
  on o.bucket_id = coalesce(a.storage_bucket, 'cellar_investor_assets')
 and o.name = a.storage_path
where a.status = 'published'
  and a.storage_path is not null
order by a.presentation_id nulls first, a.sort_order, a.created_at desc;

select
  'guest_visible_payload_shape' as check_group,
  p.id as presentation_id,
  p.title as presentation_title,
  a.id as asset_id,
  a.title as asset_title,
  a.visibility,
  a.investor_kb_scope,
  a.storage_path,
  (
    select count(*)
    from jsonb_each(coalesce(a.slide_narratives, '{}'::jsonb))
  ) as narrative_count
from public.cellar_presentations p
join public.cellar_assets a on a.presentation_id = p.id
where p.status = 'published'
  and a.status = 'published'
  and a.visibility = 'guest'
  and a.investor_kb_scope = 'investor_kb'
order by p.sort_order, a.sort_order, a.created_at desc;
