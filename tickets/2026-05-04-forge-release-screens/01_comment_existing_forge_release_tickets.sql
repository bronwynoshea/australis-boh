begin;

with refs as (
  select
    (select id from boh_user where lower(email) = 'boshea@jobzcafe.com' limit 1) as boshea_id
),
target_tickets as (
  select id, ticket_number
  from counter_ticket
  where ticket_number in ('T-0164', 'T-0165', 'T-0166', 'T-0169', 'T-0171', 'T-0176')
),
comment_text as (
  select
    $$[codex-forge-release-screen-update-2026-05-04]
Status: UPDATED IN SOURCE - related Forge release-screen work completed in codex-staging.

Summary:
- Release list, release detail, major-release support, and Forge management screens were updated together.
- Internal and external release views now use matching current/past/future scope behavior.
- Current follows the active major release quarter/year.
- Include past and include future switch to all quarters.
- Release schedule fields are now visible with clear labels: Sprint starts, Sprint ends, Agent + human testing, Release candidate, Rollout.
- Release schedule repair SQL was split into Supabase-friendly chunks for BOH dev verification.

Verification:
- npm run build passed with existing Vite chunk/import warnings.
- Awaiting BOH dev execution of the chunked release schedule SQL and empty verification result sets.

Release allocation: not allocated.$$ as body
)
insert into counter_ticket_comment (
  ticket_id,
  author_id,
  body,
  is_visible_to_requester,
  should_notify_requester,
  app_context
)
select
  t.id,
  refs.boshea_id,
  comment_text.body,
  false,
  false,
  'forge'
from target_tickets t
cross join refs
cross join comment_text
where not exists (
  select 1
  from counter_ticket_comment c
  where c.ticket_id = t.id
    and c.body like '%[codex-forge-release-screen-update-2026-05-04]%'
);

commit;
