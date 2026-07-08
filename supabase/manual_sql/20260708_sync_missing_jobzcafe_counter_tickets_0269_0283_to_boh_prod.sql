-- Sync historical JOBZCAFE Counter tickets present in BOH-DEV but missing from BOH production.
-- Idempotent: existing ticket_number rows are left unchanged.

with payload as (
  select $json$[{"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "talent", "app_context": "boh", "app_slug": "talent", "category": "feature", "code_freeze_date": null, "created_at": "2026-04-30 08:32:59.164561+00", "description": "Talent recruiters need a dedicated Decisions workspace instead of using only a Candidates filter from the Hiring Pipeline.\n\nScope:\n- Add a Decisions entry to the recruiter sidebar.\n- Build a Decisions view for outcome-stage candidates and applications.\n- Include outcomes such as offered, hired, rejected, withdrawn, and future declined/no-response states as product rules mature.\n- Link dashboard Hiring Pipeline → Decisions to this workspace.\n- Keep dashboard return behavior for users who enter from the pipeline.\n- Add action-driven empty states for workspaces with no decisions yet.\n- Support mobile stacked layout and usable tap targets.\n\nContext:\n- The MVP dashboard now links the Decisions pipeline stage to a filtered candidate outcomes view.\n- This ticket tracks the fuller product surface so Decisions becomes a first-class recruiter workspace.", "initial_user_message": null, "priority_key": "medium", "requester_email": "bronwyn@jobzcafe.com", "requester_name": "Dr. Bron O'Shea", "source": "codex", "status_key": "new", "subject": "Build Talent Decisions workspace and sidebar entry", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0269", "updated_at": "2026-06-19 08:37:58.235359+00"}, {"ai_category": null, "ai_session_id": null, "ai_similarity_checked": false, "ai_summary": null, "app": "counter", "app_context": "boh", "app_slug": "counter", "category": "bug", "code_freeze_date": null, "created_at": "2026-05-02 22:05:14.168262+00", "description": "App: counter\nStatus: OPEN - implementation still required.\nRelease allocation: not allocated.\n\nDescription:\nCounter All Tickets and Inbox are empty for boshea@jobzcafe.com even though BOH dev has Counter ticket records. Boshea is a BOH super_admin and should be able to see all Counter tickets. Mary should own Menu initiatives, not Counter tickets.\n\nCurrent diagnosis:\n- BOH dev has 282 Counter tickets.\n- counter_ticket RLS uses public.is_boh_user().\n- authenticated cannot execute public.is_boh_user() or public.is_boh_user(uuid), so ticket reads fail.\n- Most Counter tickets are assigned to the Mary BOH user row; Counter backlog should be assigned to Boshea for now.\n- 97 Counter tickets need release allocation.\n\nAcceptance notes:\n- boshea@jobzcafe.com can see Counter All Tickets in BOH dev.\n- Counter Inbox/All Tickets do not fail on the is_boh_user helper.\n- Current Counter backlog is assigned to boshea@jobzcafe.com until more ticket handlers exist.\n- Mary has no Counter ticket assignments after the repair.\n- Menu initiative ownership is not changed.\n- A Needs release filter/workflow is available for assigning outstanding tickets to minor releases.\n- Production remains untouched unless explicitly approved.", "initial_user_message": "Manual ticket created from BOH dev Counter troubleshooting thread to fill missing ticket number T-0283.", "priority_key": "high", "requester_email": "boshea@jobzcafe.com", "requester_name": "Bronwyn O'Shea", "source": "manual", "status_key": "new", "subject": "Fix Counter ticket visibility, ownership, and release allocation", "tenant_slug": "jobzcafe", "testing_end_date": null, "testing_start_date": null, "ticket_number": "T-0283", "updated_at": "2026-06-19 08:37:58.235359+00"}]$json$::jsonb as data
), source_rows as (
  select value as row_data
  from payload, jsonb_array_elements(payload.data) as value
), mapped as (
  select
    tenant.id as tenant_id,
    status.id as status_id,
    priority.id as priority_id,
    app.id as app_id,
    row_data
  from source_rows
  join public.boh_tenant tenant on tenant.slug = row_data->>'tenant_slug'
  join public.counter_ticket_status status on status.tenant_id = tenant.id and status.key = row_data->>'status_key'
  join public.counter_ticket_priority priority on priority.tenant_id = tenant.id and priority.key = row_data->>'priority_key'
  left join public.boh_app app on app.slug = nullif(row_data->>'app_slug', '')
), inserted as (
  insert into public.counter_ticket (
    ticket_number, subject, description, category, app, requester_email, source,
    ai_session_id, initial_user_message, created_at, updated_at, ai_summary,
    ai_category, ai_similarity_checked, status_id, priority_id, requester_name,
    app_id, app_context, testing_start_date, testing_end_date, code_freeze_date, tenant_id
  )
  select
    row_data->>'ticket_number', row_data->>'subject', row_data->>'description',
    row_data->>'category', row_data->>'app', row_data->>'requester_email',
    coalesce(row_data->>'source', 'manual'), nullif(row_data->>'ai_session_id', ''),
    row_data->>'initial_user_message', (row_data->>'created_at')::timestamptz,
    (row_data->>'updated_at')::timestamptz, nullif(row_data->>'ai_summary', ''),
    nullif(row_data->>'ai_category', ''), coalesce((row_data->>'ai_similarity_checked')::boolean, false),
    status_id, priority_id, row_data->>'requester_name', app_id, row_data->>'app_context',
    nullif(row_data->>'testing_start_date', '')::date,
    nullif(row_data->>'testing_end_date', '')::date,
    nullif(row_data->>'code_freeze_date', '')::date,
    tenant_id
  from mapped
  where not exists (select 1 from public.counter_ticket existing where existing.ticket_number = row_data->>'ticket_number')
  returning ticket_number, subject, created_at
)
select 'inserted' as result, * from inserted
union all
select 'already_exists' as result, ct.ticket_number, ct.subject, ct.created_at
from public.counter_ticket ct
where ct.ticket_number in ('T-0269','T-0283')
  and not exists (select 1 from inserted i where i.ticket_number = ct.ticket_number)
order by ticket_number;
