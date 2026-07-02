-- CELLAR asset rename 03/03: RPCs.
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
