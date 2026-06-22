-- CELLAR guest investors may read published guest Q&A.
drop policy if exists cellar_prepared_qa_guest_read_published on public.cellar_prepared_qa;

create policy cellar_prepared_qa_guest_read_published on public.cellar_prepared_qa
  for select using (
    status = 'published'
    and visibility = 'guest'
    and investor_kb_scope = 'investor_kb'
  );
