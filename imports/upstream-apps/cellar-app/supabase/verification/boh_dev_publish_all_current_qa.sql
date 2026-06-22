-- BOH-DEV only. Publish current usable Q&A rows for investor testing.
update public.cellar_prepared_qa
set status = 'published',
    published_at = coalesce(published_at, now()),
    updated_at = now()
where status <> 'archived';
