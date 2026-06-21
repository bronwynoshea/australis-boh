begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0304'
  limit 1
),
note as (
  select $$[[codex_loft_20260522_personal_table_live_qa_done]]
Status: FIXED IN SOURCE - Personal Table live QA regressions corrected.

Completed:
- Improved Loft login email error copy so invalid or unrecognised emails do not show raw OTP signup errors.
- Fixed Personal Table leave flow so the host no longer sees a blocking browser alert when guest request cleanup fails.
- Hardened clear-room-waitlist host profile lookup and deployed the Edge Function to JOBZCAFE-dev.
- Removed stale departed guest tiles immediately and blocked approved waitlist entries from re-adding guests after they leave.
- Exposed layout controls to external guests as well as hosts.
- Reattached video tracks across grid, sidebar, and spotlight layout changes.
- Added recovery for stalled screen sharing when the browser picker is dismissed, hidden, or no shared track arrives.

Loft commits:
- e01ccde Improve Loft login email error message.
- bf9d35d Fix Personal Table leave and layout controls.
- 657cd90 Recover stalled Personal Table screen sharing.

Validation: npm.cmd run build passed after each source change. clear-room-waitlist was deployed to JOBZCAFE-dev.$$ as body
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
      and c.body like '%[[codex_loft_20260522_personal_table_live_qa_done]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from inserted_comment) as inserted_comments;

commit;
