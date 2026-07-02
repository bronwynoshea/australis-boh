-- Read-only CELLAR prepared Q&A comparison.
-- Run separately in BOH-DEV and BOH, then compare the result sets.

select
  status,
  visibility,
  investor_kb_scope,
  count(*) as qa_count
from public.cellar_prepared_qa
group by status, visibility, investor_kb_scope
order by status, visibility, investor_kb_scope;

select
  id,
  left(question, 90) as question_preview,
  topic,
  status,
  visibility,
  investor_kb_scope,
  related_asset_id,
  sort_order,
  published_at,
  metadata->>'source' as source
from public.cellar_prepared_qa
order by sort_order, published_at desc nulls last, created_at;

select
  id,
  left(question, 90) as guest_question_preview,
  topic,
  sort_order,
  published_at
from public.cellar_prepared_qa
where status = 'published'
  and visibility = 'guest'
  and investor_kb_scope = 'investor_kb'
order by sort_order, published_at desc nulls last, created_at;
