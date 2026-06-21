begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0304'
  limit 1
),
note as (
  select $$[[codex_loft_20260531_media_control_icon_stress_fix]]
Status: FIXED IN SOURCE - Personal Table media-control icon state hardened for live-session stress.

Completed on 2026-05-31:
- Stabilized Personal Table microphone and camera tray controls so rapid repeated clicks cannot stack conflicting Daily media toggle calls.
- Added pending/busy state to mic and video tray buttons while Daily applies the requested media change.
- Reconciled local mic/video icon state back to Daily's actual device state after each toggle completes.
- Updated participant video-state mapping so a live Daily camera track is treated as camera-on, preventing remote cards from showing camera-off while video is visibly live.

Loft commit:
- 9efe525 Stabilize Personal Table media controls.

Validation: npm.cmd run build passed. Loft codex-staging remote was verified at 9efe5255bc5e9b1c79b612f377adbdac328db21a.$$ as body
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
      and c.body like '%[[codex_loft_20260531_media_control_icon_stress_fix]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from inserted_comment) as inserted_comments;

commit;
