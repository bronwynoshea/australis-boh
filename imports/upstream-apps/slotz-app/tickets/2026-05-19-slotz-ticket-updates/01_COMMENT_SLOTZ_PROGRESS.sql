begin;

with author as (
  select id
  from public.boh_user
  where app_context = 'boh'
  order by created_at asc
  limit 1
),
updates(ticket_number, marker, body) as (
  values
    (
      'T-0297',
      '[[slotz_polish_progress_20260519_commit_0405608]]',
      $$[[slotz_polish_progress_20260519_commit_0405608]]
Status: OPEN - implementation substantially advanced; final production readiness and dev/prod smoke QA still required.

Completed in SLOTZ source and pushed to GitHub commit 0405608:
- Login, visual system, app shell, staff calendar/agenda, settings, public booking/manage, integrations, feedback, responsive QA, and accessibility polish through step 10.
- Outlook and Google integration UX aligned with connected/sync states.
- Manual/public booking confirmation path now sends guest/staff emails, creates Patron person records, and uses reminder-only calendar content.
- Reusable workflow plan documented for enterprise polish QA and environment promotion skills.

Release allocation: not allocated.$$ 
    ),
    (
      'T-0285',
      '[[slotz_rename_progress_20260519]]',
      $$[[slotz_rename_progress_20260519]]
Status: CLOSED IN SOURCE - release allocation needed.

SLOTZ source now uses SLOTZ naming for the scheduling app path. A source scan found no active app-source CHATZ references; remaining matches are historical ticket/AGENTS notes that describe the rename history and guardrail.

Production promotion remains human-gated and should be verified with the SLOTZ smoke checklist before closing in release.

Release allocation: not allocated.$$
    ),
    (
      'T-0293',
      '[[codex_reusable_skills_plan_20260519]]',
      $$[[codex_reusable_skills_plan_20260519]]
Status: OPEN - plan drafted; skill installation still required.

Created docs/REUSABLE_CODEX_WORKFLOW_SKILLS_PLAN.md in SLOTZ with two proposed reusable skills:
- enterprise-polish-qa
- environment-promotion-runbook

The plan includes the reusable 1-11 enterprise polish sequence and maps it generically for SLOTZ, BOH, JOBZCAFE, and Talent-style products. Next step is to convert the plan into installed Codex skills and reuse them across projects.

Release allocation: not allocated.$$
    )
),
targets as (
  select t.id, u.ticket_number, u.marker, u.body
  from updates u
  join public.counter_ticket t on t.ticket_number = u.ticket_number
),
inserted as (
  insert into public.counter_ticket_comment (
    ticket_id,
    author_id,
    body,
    is_visible_to_requester,
    should_notify_requester,
    app_context,
    created_at
  )
  select
    t.id,
    a.id,
    t.body,
    false,
    false,
    'slotz',
    now()
  from targets t
  cross join author a
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = t.id
      and c.body like '%' || t.marker || '%'
  )
  returning id
)
select count(*) as comments_inserted
from inserted;

commit;
