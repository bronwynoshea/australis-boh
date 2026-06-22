-- CELLAR content policy refresh to use non-exposed private helper functions.
drop policy if exists cellar_presentations_staff_all on public.cellar_presentations;
create policy cellar_presentations_staff_all on public.cellar_presentations
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_presentations_verified_read_published on public.cellar_presentations;
create policy cellar_presentations_verified_read_published on public.cellar_presentations
  for select using (status = 'published' and cellar_private.has_verified_investor_access());

drop policy if exists cellar_materials_staff_all on public.cellar_materials;
create policy cellar_materials_staff_all on public.cellar_materials
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_materials_verified_read_published on public.cellar_materials;
create policy cellar_materials_verified_read_published on public.cellar_materials
  for select using (
    status = 'published' and investor_kb_scope = 'investor_kb'
    and (
      (visibility in ('guest', 'verified') and cellar_private.has_verified_investor_access())
      or (visibility = 'appendix_granted' and cellar_private.current_investor_access_status() = 'appendix_granted')
    )
  );

drop policy if exists cellar_material_access_requests_staff_all on public.cellar_material_access_requests;
create policy cellar_material_access_requests_staff_all on public.cellar_material_access_requests
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_material_access_requests_verified_self_read on public.cellar_material_access_requests;
create policy cellar_material_access_requests_verified_self_read on public.cellar_material_access_requests
  for select using (cellar_private.is_verified_investor(investor_access_id));

drop policy if exists cellar_prepared_qa_staff_all on public.cellar_prepared_qa;
create policy cellar_prepared_qa_staff_all on public.cellar_prepared_qa
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_prepared_qa_verified_read_published on public.cellar_prepared_qa;
create policy cellar_prepared_qa_verified_read_published on public.cellar_prepared_qa
  for select using (
    status = 'published' and investor_kb_scope = 'investor_kb'
    and (
      (visibility in ('guest', 'verified') and cellar_private.has_verified_investor_access())
      or (visibility = 'appendix_granted' and cellar_private.current_investor_access_status() = 'appendix_granted')
    )
  );

drop policy if exists cellar_investor_questions_staff_all on public.cellar_investor_questions;
create policy cellar_investor_questions_staff_all on public.cellar_investor_questions
  for all using (cellar_private.current_boh_user_id() is not null)
  with check (cellar_private.current_boh_user_id() is not null);

drop policy if exists cellar_investor_questions_verified_self_read on public.cellar_investor_questions;
create policy cellar_investor_questions_verified_self_read on public.cellar_investor_questions
  for select using (investor_access_id is not null and cellar_private.is_verified_investor(investor_access_id));

drop policy if exists cellar_investor_notes_staff_shared_read on public.cellar_investor_notes;
create policy cellar_investor_notes_staff_shared_read on public.cellar_investor_notes
  for select using (visibility = 'shared_with_staff' and cellar_private.staff_can_access_investor(investor_access_id));

drop policy if exists cellar_investor_notes_verified_self_all on public.cellar_investor_notes;
create policy cellar_investor_notes_verified_self_all on public.cellar_investor_notes
  for all using (cellar_private.is_verified_investor(investor_access_id))
  with check (cellar_private.is_verified_investor(investor_access_id));
