-- CELLAR RPCs for Investor KB Q&A search, scoped messages, and booking-link audit.
create or replace function public.cellar_search_prepared_qa(p_query text, p_limit integer default 10, p_session_id uuid default null)
returns table(id uuid, question text, answer text, topic text, related_material_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select cpq.id, cpq.question, cpq.answer, cpq.topic, cpq.related_material_id
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

create or replace function public.cellar_create_investor_question(p_investor_access_id uuid, p_question text, p_material_id uuid default null)
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
  insert into public.cellar_investor_questions (investor_access_id, related_material_id, question)
  values (p_investor_access_id, p_material_id, p_question)
  returning id into cellar_question_id;
  return cellar_question_id;
end;
$$;

create or replace function public.cellar_create_message(p_thread_id uuid, p_investor_access_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_message_id uuid;
begin
  if not (public.cellar_is_verified_investor(p_investor_access_id) or public.cellar_staff_can_access_investor(p_investor_access_id)) then
    raise exception 'CELLAR_MESSAGE_ACCESS_DENIED' using errcode = '28000';
  end if;
  insert into public.cellar_messages (thread_id, investor_access_id, sender_kind, sender_auth_user_id, sender_boh_user_id, body)
  values (p_thread_id, p_investor_access_id, case when public.cellar_current_boh_user_id() is null then 'investor' else 'staff' end,
    auth.uid(), public.cellar_current_boh_user_id(), p_body)
  returning id into cellar_message_id;
  update public.cellar_message_threads set last_message_at = now() where id = p_thread_id;
  return cellar_message_id;
end;
$$;

create or replace function public.cellar_create_booking_link_audit(p_investor_access_id uuid, p_booking_url text, p_metadata jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cellar_link_id uuid;
begin
  if not (public.cellar_is_verified_investor(p_investor_access_id) or public.cellar_staff_can_access_investor(p_investor_access_id)) then
    raise exception 'CELLAR_BOOKING_LINK_AUDIT_ACCESS_DENIED' using errcode = '28000';
  end if;

  insert into public.cellar_booking_link_audits (investor_access_id, booking_url, metadata)
  values (p_investor_access_id, p_booking_url, coalesce(p_metadata, '{}'::jsonb))
  returning id into cellar_link_id;
  return cellar_link_id;
end;
$$;
