-- Record completed Talent -> BOH Loft interview-room work in Counter.
-- Safe/idempotent: inserts one Counter ticket for the JOBZCAFE® tenant only if
-- the same subject does not already exist.

with ctx as (
  select
    t.id as tenant_id,
    closed_status.id as status_id,
    high_priority.id as priority_id,
    loft_app.id as app_id
  from public.boh_tenant t
  join public.counter_ticket_status closed_status
    on closed_status.tenant_id = t.id
   and closed_status.key = 'closed'
  join public.counter_ticket_priority high_priority
    on high_priority.tenant_id = t.id
   and high_priority.key = 'high'
  left join public.boh_app loft_app
    on loft_app.slug = 'loft'
  where t.slug = 'jobzcafe'
  limit 1
), inserted as (
  insert into public.counter_ticket (
    tenant_id,
    subject,
    description,
    category,
    app,
    app_id,
    app_context,
    status_id,
    priority_id,
    requester_name,
    requester_email,
    source,
    initial_user_message,
    ai_summary,
    ai_category
  )
  select
    ctx.tenant_id,
    'Record: Talent interview rooms promoted to BOH Loft production',
    'Completed and promoted the JOBZCAFE® Talent interview-room bridge into BOH Loft.

Scope recorded:
- Talent recruiter Open call room flow now opens the BOH-owned Loft wrapper instead of raw Daily.co or BOH login.
- Jobseeker guest Loft links are supported for interview rooms.
- JOBZCAFE® production Supabase received the Talent interview bridge schema and talent-interview-request Edge Function.
- BOH production Supabase received the Loft identity/member bridge schema and updated Loft/Talent Edge Functions.
- Production bridge secrets were set for JOBZCAFE® -> BOH and BOH -> Loft token generation.
- loft.jobzcafe.com is now the JOBZCAFE® user-facing Loft URL in production function config and CORS.
- Relevant code/migration records were pushed to hermes-staging in talent-app and australis-boh.

Verification completed:
- Local recruiter and jobseeker flows tested.
- Production Supabase schema/function presence verified.
- Production function smoke checks returned expected safe responses.
- BOH CORS preflight allows https://loft.jobzcafe.com.

Remaining outside this ticket:
- Cloudflare Pages frontend deployment/attachment verification for loft.jobzcafe.com on australis-boh.
- Final live browser E2E after Cloudflare deployment is active.',
    'release-record',
    'loft',
    ctx.app_id,
    'boh',
    ctx.status_id,
    ctx.priority_id,
    'Hermes Agent',
    'admin@australis.cloud',
    'hermes-session-record',
    'Record of completed Talent -> BOH Loft interview-room promotion from Hermes session on 2026-07-08.',
    'Talent interview rooms were promoted into BOH Loft with production schema, functions, secrets, and loft.jobzcafe.com routing/CORS prepared. Cloudflare frontend verification remains separate.',
    'release-record'
  from ctx
  where not exists (
    select 1
    from public.counter_ticket existing
    where existing.tenant_id = ctx.tenant_id
      and existing.subject = 'Record: Talent interview rooms promoted to BOH Loft production'
  )
  returning id, ticket_number, subject, created_at
)
select 'inserted' as result, id, ticket_number, subject, created_at
from inserted
union all
select 'already_exists' as result, existing.id, existing.ticket_number, existing.subject, existing.created_at
from public.counter_ticket existing
join ctx on ctx.tenant_id = existing.tenant_id
where existing.subject = 'Record: Talent interview rooms promoted to BOH Loft production'
  and not exists (select 1 from inserted)
order by created_at desc
limit 1;
