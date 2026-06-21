begin;

with notes(ticket_number, marker, body) as (
  values
    (
      'T-0113',
      '[[codex_loft_20260505_connection_stability]]',
      $$[[codex_loft_20260505_connection_stability]]
Status: OPEN - implementation still required.

Loft review on 2026-05-05 found the meeting runtime still needs product-grade hardening. Key items: bind Daily local/remote screen-share events directly; make screen share render reliably inside the Loft frame or fullscreen; consolidate background filters into one authoritative media pipeline; prevent transport controls from double toggling on touch devices; keep personal-room guests waiting until the host opens the room; and make approved guests transition without refresh. Personal rooms should retain separate host/private and participant-friendly links, with participant access routed through the human-readable slug and Slotz later able to create/supply those links.$$ 
    ),
    (
      'T-0114',
      '[[codex_loft_20260505_error_states]]',
      $$[[codex_loft_20260505_error_states]]
Status: OPEN - implementation still required.

Loft error handling needs a pass after the 2026-05-05 review. Remove silent fallbacks that hide backend issues; replace duplicate table/session load errors with one clear state; avoid saying "rooms" in user-facing Loft screens except where technically unavoidable; stop stale login/session messages from appearing before the user sends a code; and ensure personal-room "not available" messages explain whether the slug/invite link is missing, expired, or waiting for host setup.$$ 
    ),
    (
      'T-0118',
      '[[codex_loft_20260505_lobby_profile_responsive]]',
      $$[[codex_loft_20260505_lobby_profile_responsive]]
Status: OPEN - implementation still required.

Loft lobby/profile polish from the 2026-05-05 review: personal tables should be Loft-branded, not Cafe-branded; cards can be denser, with list view as the work view; "always available" should be removed from owner/superadmin personal-table cards; personal-table date labels are not useful; session cards should support subtle app-context color cues for Cafe/Journey/Coach/Mentor/DNA without overpowering the distinct Loft palette; profile should open as a full-height side drawer on desktop and a bottom sheet on mobile, without blanking the lobby behind it; profile should keep only essential identity/photo details now, with room/device/background preferences added as internal-user settings.$$ 
    ),
    (
      'T-0119',
      '[[codex_loft_20260505_mobile_browser]]',
      $$[[codex_loft_20260505_mobile_browser]]
Status: OPEN - implementation still required.

Mobile browser review on 2026-05-05 found the personal-room host side panel is not acceptable on mobile: host controls/waiting approvals should use a bottom drawer or sheet, the panel must be closable, and approved guests must enter without needing a refresh. Also verify the member login, home, lobby, profile drawer/sheet, personal-room waiting screen, and room controls across mobile breakpoints with hidden scrollbars but preserved scrolling.$$ 
    ),
    (
      'T-0117',
      '[[codex_loft_20260505_test_coverage]]',
      $$[[codex_loft_20260505_test_coverage]]
Status: OPEN - implementation still required.

Add Loft regression coverage for the issues found on 2026-05-05: OTP/member login session persistence, profile loading from auth user to profile only, lobby all/mine filtering for superadmin versus regular users, personal-room host and guest slug resolution, waitlist request/approve/status transitions, Daily screen-share event binding, background filter state propagation, touch transport controls, responsive drawer/sheet behavior, and WCAG contrast for light and dark themes.$$ 
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
  select
    id,
    body,
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
select
  (select count(*) from target_tickets) as matched_tickets,
  (select count(*) from inserted) as inserted_comments;

commit;
