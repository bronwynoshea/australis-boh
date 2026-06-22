-- CELLAR content RLS policies scoped to published investor-facing records.
alter table public.cellar_presentations enable row level security;
alter table public.cellar_materials enable row level security;
alter table public.cellar_material_access_requests enable row level security;
alter table public.cellar_prepared_qa enable row level security;
alter table public.cellar_investor_questions enable row level security;
alter table public.cellar_investor_notes enable row level security;

create policy cellar_presentations_staff_all on public.cellar_presentations
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);
create policy cellar_presentations_verified_read_published on public.cellar_presentations
  for select using (status = 'published' and public.cellar_has_verified_investor_access());

create policy cellar_materials_staff_all on public.cellar_materials
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);
create policy cellar_materials_verified_read_published on public.cellar_materials
  for select using (
    status = 'published'
    and investor_kb_scope = 'investor_kb'
    and (
      (visibility in ('guest', 'verified') and public.cellar_has_verified_investor_access())
      or (visibility = 'appendix_granted' and public.cellar_current_investor_access_status() = 'appendix_granted')
    )
  );

create policy cellar_material_access_requests_staff_all on public.cellar_material_access_requests
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);
create policy cellar_material_access_requests_verified_self_read on public.cellar_material_access_requests
  for select using (public.cellar_is_verified_investor(investor_access_id));

create policy cellar_prepared_qa_staff_all on public.cellar_prepared_qa
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);
create policy cellar_prepared_qa_verified_read_published on public.cellar_prepared_qa
  for select using (
    status = 'published'
    and investor_kb_scope = 'investor_kb'
    and (
      (visibility in ('guest', 'verified') and public.cellar_has_verified_investor_access())
      or (visibility = 'appendix_granted' and public.cellar_current_investor_access_status() = 'appendix_granted')
    )
  );

create policy cellar_investor_questions_staff_all on public.cellar_investor_questions
  for all using (public.cellar_current_boh_user_id() is not null)
  with check (public.cellar_current_boh_user_id() is not null);
create policy cellar_investor_questions_verified_self_read on public.cellar_investor_questions
  for select using (investor_access_id is not null and public.cellar_is_verified_investor(investor_access_id));

create policy cellar_investor_notes_staff_shared_read on public.cellar_investor_notes
  for select using (visibility = 'shared_with_staff' and public.cellar_staff_can_access_investor(investor_access_id));
create policy cellar_investor_notes_verified_self_all on public.cellar_investor_notes
  for all using (public.cellar_is_verified_investor(investor_access_id))
  with check (public.cellar_is_verified_investor(investor_access_id));
