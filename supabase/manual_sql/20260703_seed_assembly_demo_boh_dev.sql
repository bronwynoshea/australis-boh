begin;

with tenant as (
  select id from public.boh_tenant where slug = 'jobzcafe' limit 1
), cleanup_handoff as (
  delete from public.assembly_handoff h
  using public.assembly_outcome o, tenant t
  where h.outcome_id = o.id
    and o.tenant_id = t.id
    and o.title in (
      'Review Australis rollout initiative ownership',
      'Prepare Loft demo readiness checklist',
      'Confirm central notification go-live path'
    )
), cleanup_outcome as (
  delete from public.assembly_outcome o
  using tenant t
  where o.tenant_id = t.id
    and o.title in (
      'Review Australis rollout initiative ownership',
      'Prepare Loft demo readiness checklist',
      'Confirm central notification go-live path'
    )
), cleanup_attendance as (
  delete from public.assembly_attendance a
  using public.assembly_meeting m, tenant t
  where a.meeting_id = m.id
    and m.tenant_id = t.id
    and m.title in ('Weekly operating assembly', 'Loft demo readiness review')
), cleanup_agenda as (
  delete from public.assembly_agenda_item ai
  using public.assembly_meeting m, tenant t
  where ai.meeting_id = m.id
    and m.tenant_id = t.id
    and m.title in ('Weekly operating assembly', 'Loft demo readiness review')
), cleanup_review as (
  delete from public.assembly_review r
  using tenant t
  where r.tenant_id = t.id
    and r.title in ('Weekly operating review', 'Q3 readiness review')
), cleanup_resolution as (
  delete from public.assembly_resolution r
  using tenant t
  where r.tenant_id = t.id
    and r.title in ('Approve BOH module ownership model', 'Confirm no direct Assembly to Forge handoff')
), cleanup_meeting as (
  delete from public.assembly_meeting m
  using tenant t
  where m.tenant_id = t.id
    and m.title in ('Weekly operating assembly', 'Loft demo readiness review')
), cleanup_memo as (
  delete from public.assembly_memo m
  using tenant t
  where m.tenant_id = t.id
    and m.title in (
      'Australis rollout ownership memo',
      'Loft demo readiness memo',
      'Central notifications go-live memo'
    )
), users as (
  select
    (select id from public.boh_user where tenant_id = (select id from tenant) and email = 'boshea@jobzcafe.com' limit 1) as bronwyn_id,
    (select id from public.boh_user where tenant_id = (select id from tenant) and email = 'success@jobzcafe.com' limit 1) as success_id,
    (select id from public.boh_user where tenant_id = (select id from tenant) and email = 'jloomis@jobzcafe.com' limit 1) as john_id
), memos as (
  insert into public.assembly_memo (tenant_id, title, what_text, how_text, now_text, requested_decision, status, memo_type, priority, author_id)
  select t.id, v.title, v.what_text, v.how_text, v.now_text, v.requested_decision, v.status, v.memo_type, v.priority, v.author_id
  from tenant t cross join users u
  cross join lateral (values
    ('Australis rollout ownership memo', 'Australis needs a clean decision trail for what belongs in Menu, Forge, Tablez and Assembly.', 'Use Assembly to capture the decision and create owner follow-up tasks for Menu review, without creating Forge workstreams directly.', 'Agree the ownership split and hand off a review task to the Menu owner.', 'Confirm Assembly should send owner tasks to Tablez before Menu initiative creation.', 'submitted', 'operating', 'high', u.bronwyn_id),
    ('Loft demo readiness memo', 'Loft has moved from standalone JOBZCAFE app to BOH-owned module.', 'Keep Loft routes inside BOH, validate Slotz/Talent session flow, and remove standalone host assumptions.', 'Finalize demo checklist and assign readiness owners.', 'Approve demo readiness checklist and explicit no-redirect Loft routing.', 'accepted', 'operating', 'high', u.success_id),
    ('Central notifications go-live memo', 'BOH needs central SMS/notification infrastructure before app-specific notification growth.', 'Keep provider secrets and dispatch centrally in BOH with source_app and cost attribution.', 'Decide whether production should remain provider=none or enable Twilio after demo.', 'Decide SMS provider go-live path.', 'deferred', 'governance', 'normal', u.bronwyn_id)
  ) as v(title, what_text, how_text, now_text, requested_decision, status, memo_type, priority, author_id)
  returning id, tenant_id, title
), meetings as (
  insert into public.assembly_meeting (tenant_id, title, meeting_type, scheduled_at, chair_id, status, minutes_summary)
  select t.id, v.title, v.meeting_type, v.scheduled_at, v.chair_id, v.status, v.minutes_summary
  from tenant t cross join users u
  cross join lateral (values
    ('Weekly operating assembly', 'operating', now() + interval '1 day', u.bronwyn_id, 'minutes_draft', 'Reviewed rollout ownership, Loft readiness, and notification go-live sequencing.'),
    ('Loft demo readiness review', 'review', now() + interval '2 days', u.success_id, 'planned', null)
  ) as v(title, meeting_type, scheduled_at, chair_id, status, minutes_summary)
  returning id, tenant_id, title
), agenda as (
  insert into public.assembly_agenda_item (tenant_id, meeting_id, memo_id, title, purpose, sort_order, timebox_minutes, status)
  select m.tenant_id, m.id, memo.id, v.title, v.purpose, v.sort_order, v.timebox_minutes, v.status
  from meetings m
  join lateral (values
    ('Weekly operating assembly', 'Australis rollout ownership memo', 'Confirm BOH ownership split', 'decide', 1, 15, 'covered'),
    ('Weekly operating assembly', 'Central notifications go-live memo', 'Notification go-live posture', 'defer', 2, 10, 'covered'),
    ('Loft demo readiness review', 'Loft demo readiness memo', 'Loft, Slotz and Talent demo readiness', 'approve', 1, 20, 'planned')
  ) as v(meeting_title, memo_title, title, purpose, sort_order, timebox_minutes, status) on v.meeting_title = m.title
  join memos memo on memo.title = v.memo_title
  returning id, tenant_id, meeting_id, memo_id, title
), outcomes as (
  insert into public.assembly_outcome (tenant_id, meeting_id, agenda_item_id, memo_id, title, outcome_type, summary, owner_id, due_date, handoff_target, handoff_status)
  select a.tenant_id, a.meeting_id, a.id, a.memo_id, v.title, v.outcome_type, v.summary, v.owner_id, current_date + v.due_in_days, v.handoff_target, v.handoff_status
  from agenda a cross join users u
  join lateral (values
    ('Confirm BOH ownership split', 'Review Australis rollout initiative ownership', 'action', 'Create a Tablez owner task for Menu review before any new Menu initiative is created.', u.bronwyn_id, 3, 'tablez', 'pending'),
    ('Loft, Slotz and Talent demo readiness', 'Prepare Loft demo readiness checklist', 'approval', 'Finalize checklist for BOH-native Loft routes, Slotz scheduling, and Talent interview bridge.', u.success_id, 1, 'tablez', 'pending'),
    ('Notification go-live posture', 'Confirm central notification go-live path', 'deferral', 'Keep production SMS provider disabled until secrets and provider decision are explicitly approved.', u.bronwyn_id, 7, 'none', 'not_required')
  ) as v(agenda_title, title, outcome_type, summary, owner_id, due_in_days, handoff_target, handoff_status) on v.agenda_title = a.title
  returning id, tenant_id, title, handoff_target
), handoffs as (
  insert into public.assembly_handoff (tenant_id, outcome_id, target_app, status, message)
  select tenant_id, id,
         case when title = 'Review Australis rollout initiative ownership' then 'tablez' else 'tablez' end,
         'pending',
         case when title = 'Review Australis rollout initiative ownership'
           then 'Create owner task for Menu owner to review whether a Menu initiative should be created or updated.'
           else 'Create owner task for demo readiness review across Loft, Slotz and Talent.'
         end
  from outcomes
  where handoff_target = 'tablez'
  returning id
), resolutions as (
  insert into public.assembly_resolution (tenant_id, meeting_id, title, resolution_type, status, approved_at, summary)
  select t.id, m.id, v.title, v.resolution_type, v.status, v.approved_at, v.summary
  from tenant t
  left join meetings m on m.title = 'Weekly operating assembly'
  cross join lateral (values
    ('Approve BOH module ownership model', 'board', 'approved', now(), 'Assembly records decisions; Menu owns initiatives; Forge owns workstreams; Tablez owns owner tasks.'),
    ('Confirm no direct Assembly to Forge handoff', 'written_consent', 'approved', now(), 'Assembly outcomes should route through owner review rather than automatically creating Forge workstreams.')
  ) as v(title, resolution_type, status, approved_at, summary)
  returning id
), reviews as (
  insert into public.assembly_review (tenant_id, title, cadence, period_label, status, meeting_id)
  select t.id, v.title, v.cadence, v.period_label, v.status, m.id
  from tenant t
  cross join lateral (values
    ('Weekly operating review', 'weekly', 'Week of current demo', 'in_review', 'Weekly operating assembly'),
    ('Q3 readiness review', 'quarterly', 'Q3 readiness', 'open', 'Loft demo readiness review')
  ) as v(title, cadence, period_label, status, meeting_title)
  left join meetings m on m.title = v.meeting_title
  returning id
)
insert into public.assembly_attendance (tenant_id, meeting_id, user_id, display_name, role, attendance_status)
select m.tenant_id, m.id, v.user_id, v.display_name, v.role, v.attendance_status
from meetings m cross join users u
cross join lateral (values
  ('Weekly operating assembly', u.bronwyn_id, 'Bronwyn OShea', 'chair', 'present'),
  ('Weekly operating assembly', u.success_id, 'Success Agent', 'secretary', 'present'),
  ('Weekly operating assembly', u.john_id, 'John Loomis', 'attendee', 'expected'),
  ('Loft demo readiness review', u.bronwyn_id, 'Bronwyn OShea', 'attendee', 'expected'),
  ('Loft demo readiness review', u.success_id, 'Success Agent', 'chair', 'expected')
) as v(meeting_title, user_id, display_name, role, attendance_status)
where v.meeting_title = m.title;

commit;
