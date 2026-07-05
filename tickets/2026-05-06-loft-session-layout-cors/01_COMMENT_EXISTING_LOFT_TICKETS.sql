begin;

with notes(ticket_number, marker, body) as (
  values
    (
      'T-0113',
      '[[codex_loft_20260506_session_runtime_progress]]',
      $$[[codex_loft_20260506_session_runtime_progress]]
Status: OPEN - implementation still requires release validation.

Progress on 2026-05-06: Loft session joining was hardened by routing session status and participant role reads through approved Edge Function/service paths instead of direct browser REST reads that were blocked by RLS. Remaining work is release validation for Daily join, participant refresh, raised-hands calls, and host/session transitions across localhost, retired standalone Loft dev and production hostnames.$$
    ),
    (
      'T-0114',
      '[[codex_loft_20260506_no_fallback_cors]]',
      $$[[codex_loft_20260506_no_fallback_cors]]
Status: OPEN - implementation still requires environment verification.

Progress on 2026-05-06: Loft Edge Function CORS handling was reviewed against the no-silent-fallback rule. Hardcoded app.jobzcafe.com origins must stay removed from Loft functions, allowed origins must come from explicit environment configuration, and failures should surface clearly rather than substituting legacy/default origins.$$
    ),
    (
      'T-0118',
      '[[codex_loft_20260506_table_layout_polish]]',
      $$[[codex_loft_20260506_table_layout_polish]]
Status: OPEN - implementation still requires responsive QA.

Progress on 2026-05-06: Loft session/table layout polish removed the visible participant-card background tint, restored centered desktop participant grids, kept hidden horizontal scrolling behavior, adjusted laptop/short-height transport sizing, simplified listener cards, and refined the host stage card toward the participant-card proportions. Validate full desktop, laptop-height, and personal-table variants before release allocation.$$
    ),
    (
      'T-0119',
      '[[codex_loft_20260506_laptop_breakpoints]]',
      $$[[codex_loft_20260506_laptop_breakpoints]]
Status: OPEN - implementation still requires browser/device validation.

Progress on 2026-05-06: Loft laptop behavior now needs explicit height-based QA, not only width-based QA. The laptop target is one participant row with hidden horizontal scrolling and enough space for the transport bar below; large desktop should continue to show full cards centered with multiple rows before scrolling.$$
    ),
    (
      'T-0117',
      '[[codex_loft_20260506_layout_cors_regression_tests]]',
      $$[[codex_loft_20260506_layout_cors_regression_tests]]
Status: OPEN - test coverage still required.

Add regression coverage for the 2026-05-06 Loft hardening pass: explicit CORS origin handling with no silent fallbacks, localhost/dev/prod origin checks, session join without direct browser RLS reads, laptop-height participant rail behavior, hidden horizontal scrolling, centered desktop grids, personal-table tint removal, and listener-card controls hidden unless the participant is promoted.$$
    )
),
target_tickets as (
  select t.id, t.ticket_number, n.marker, n.body
  from public.counter_ticket t
  join notes n on n.ticket_number = t.ticket_number
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
  select id, body, false, false, 'loft', now()
  from target_tickets tt
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%' || tt.marker || '%'
  )
  returning ticket_id
)
select
  (select count(*) from target_tickets) as matched_tickets,
  (select count(*) from inserted) as inserted_comments;

commit;
