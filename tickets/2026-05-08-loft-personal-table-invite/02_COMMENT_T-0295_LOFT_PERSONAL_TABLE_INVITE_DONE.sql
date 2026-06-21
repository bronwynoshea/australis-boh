begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0295'
),
note as (
  select $$[[codex_loft_20260508_personal_table_invite_done]]
Status: CLOSED IN SOURCE - release allocation needed.

Completed on 2026-05-08 in Loft local staging. The Personal Table page now uses the native Loft card style and a simpler enterprise-grade invite workflow: Join as Host and Copy guest link are aligned as matched top actions; the raw guest URL is hidden from the main control surface; the email template has no internal scrolling; and the email preview shows Join my Personal Table as a link-style item while copied invite text includes the actual working URL. Build passed with only the existing AnimatedBackgroundBlobs and chunk-size warnings.$$ as body
),
inserted as (
  insert into public.counter_ticket_comment (
    ticket_id,
    body,
    is_visible_to_requester,
    should_notify_requester,
    app_context,
    created_at
  )
  select tt.id, n.body, false, false, 'loft', now()
  from target_ticket tt
  cross join note n
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%[[codex_loft_20260508_personal_table_invite_done]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from inserted) as inserted_comments;

commit;
