begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0304'
  limit 1
),
note as (
  select $$[[codex_loft_20260529_laptop_video_card_framing]]
Status: FIXED IN SOURCE - laptop participant card video framing corrected.

Completed on 2026-05-29:
- Preserved a stable 16:9 video area on Personal Table participant cards so laptop screens do not crop people to the top of the camera frame.
- Changed participant video rendering to contain the full camera image instead of cutting off the lower portion of the feed.
- Kept host and guest card footers at a consistent height so the host label does not make that card taller than the others.
- Kept three participants across on laptop-sized screens before the four-person grid resize behaviour applies.

Loft commit:
- 3a6597d Preserve Personal Table video framing on laptops.

Validation: npm.cmd run build passed. Loft codex-staging remote was verified at 3a6597de5b9ae06caa2ad9031444af252a4f43b1.$$ as body
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
  select tt.id, n.body, false, false, 'loft', now()
  from target_ticket tt
  cross join note n
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%[[codex_loft_20260529_laptop_video_card_framing]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from inserted_comment) as inserted_comments;

commit;
