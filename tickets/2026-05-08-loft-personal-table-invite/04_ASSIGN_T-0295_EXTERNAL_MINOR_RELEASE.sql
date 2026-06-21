begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0295'
),
target_release as (
  select id
  from public.boh_release_version
  where version_label = 'Lapsang Souchong'
    and version_number = '3.2.0'
    and environment = 'external'
    and release_tier = 'minor'
  limit 1
),
updated_ticket as (
  update public.counter_ticket ct
  set release_version_id = tr.id,
      updated_at = now()
  from target_ticket tt
  cross join target_release tr
  where ct.id = tt.id
    and ct.release_version_id is distinct from tr.id
  returning ct.id
),
release_note as (
  select $$[[codex_loft_20260508_personal_table_invite_release_allocated]]
Release allocation: Lapsang Souchong 3.2.0 external.$$ as body
),
inserted_comment as (
  insert into public.counter_ticket_comment (
    ticket_id,
    body,
    is_visible_to_requester,
    should_notify_requester,
    app_context,
    created_at
  )
  select tt.id, rn.body, false, false, 'loft', now()
  from target_ticket tt
  cross join target_release tr
  cross join release_note rn
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%[[codex_loft_20260508_personal_table_invite_release_allocated]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from target_release) as matched_releases,
  (select count(*) from updated_ticket) as updated_tickets,
  (select count(*) from inserted_comment) as inserted_comments;

commit;
