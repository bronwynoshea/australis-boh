begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0298'
  limit 1
),
note as (
  select $$[[codex_loft_20260517_personal_tables_admin_done]]
Status: FIXED IN SOURCE - release allocation prepared.

Implemented:
- Added /admin/personal-tables.
- Added sidebar/mobile nav entry Personal Tables for user_type_id = 5 only.
- Added admin screen to list members with Personal Table access.
- Added enable access by email.
- Added disable access.
- Added copy guest invite links.
- Added rotate guest invite links.
- Added authenticated JOBZCAFE-dev Edge Function loft-admin-list-personal-tables.
- Added authenticated JOBZCAFE-dev Edge Function loft-admin-manage-personal-table.
- Updated loft-review-host-application so JOBZCAFE® superadmins can also use the host application review surface.
- Removed the old frontend shortcut that showed Personal Table access to every signed-in user.
- Updated supabase/config.toml and docs/loft-change-ledger.md.

Deployed to JOBZCAFE-dev:
- loft-admin-list-personal-tables.
- loft-admin-manage-personal-table.
- loft-review-host-application.$$ as body
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
      and c.body like '%[[codex_loft_20260517_personal_tables_admin_done]]%'
  )
  returning ticket_id
)
select
  (select count(*) from target_ticket) as matched_tickets,
  (select count(*) from inserted_comment) as inserted_comments;

commit;
