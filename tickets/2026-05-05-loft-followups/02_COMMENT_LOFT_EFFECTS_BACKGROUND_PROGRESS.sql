begin;

with notes(ticket_number, marker, body) as (
  values
    (
      'T-0113',
      '[[codex_loft_20260505_effects_runtime_progress]]',
      $$[[codex_loft_20260505_effects_runtime_progress]]
Status: OPEN - implementation still required.

Progress on 2026-05-05: personal tables and Loft session rooms now create Daily call objects with video processor support enabled for the installed Daily client, and the Effects panel applies the new Daily processor path for blur/background images. Six Loft-owned virtual background assets were generated and wired into the Effects picker. Remaining work: make the settings preview bind to the processed Daily track, verify remote participants see the processed video after a second-user test, and keep screen share/runtime stability in the same hardening pass.$$ 
    ),
    (
      'T-0118',
      '[[codex_loft_20260505_effects_ui_assets_progress]]',
      $$[[codex_loft_20260505_effects_ui_assets_progress]]
Status: OPEN - implementation still required.

Progress on 2026-05-05: Effects settings were restyled toward the Loft theme, the microphone level meter now fills its rail cleanly, and the built-in background picker now uses six JOBZCAFE®/Loft-owned 16:9 background images: Skyline Window, Focus Office, Library Wall, Studio Glass, Career Cafe, and Evening Suite. Remaining polish: add optimized thumbnails/compressed delivery assets, confirm the preview/main table visual states match, and review the resulting public asset weight before release allocation.$$ 
    ),
    (
      'T-0119',
      '[[codex_loft_20260505_effects_browser_support]]',
      $$[[codex_loft_20260505_effects_browser_support]]
Status: OPEN - implementation still required.

Browser/device compatibility note from 2026-05-05: Daily background blur and virtual backgrounds are capability-gated by Daily video processing support. The UI now needs final copy and behavior for unsupported browser windows/mobile browsers so users are told clearly when effects are unavailable instead of seeing a generic processor failure. Validate Chrome desktop, the Codex browser window, iOS Safari, and mobile Chrome before marking this browser ticket complete.$$ 
    ),
    (
      'T-0117',
      '[[codex_loft_20260505_effects_regression_tests]]',
      $$[[codex_loft_20260505_effects_regression_tests]]
Status: OPEN - implementation still required.

Test coverage note from 2026-05-05: add regression coverage for Effects settings and Daily processor behavior, including applying blur, applying each built-in background, turning effects off, unsupported-browser messaging, preview track refresh, main table video refresh, and remote participant visibility after a second-user join. Also cover the no-silent-fallback rule for device/background failures.$$ 
    )
),
target_tickets as (
  select t.id, n.marker, n.body
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
  select
    tt.id,
    tt.body,
    false,
    false,
    'loft',
    now()
  from target_tickets tt
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%' || tt.marker || '%'
  )
  returning ticket_id
)
select count(*) as comments_inserted from inserted;

commit;
