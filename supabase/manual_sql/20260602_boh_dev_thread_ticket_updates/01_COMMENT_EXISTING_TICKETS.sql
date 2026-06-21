begin;

with author as (
  select id
  from public.boh_user
  where lower(email) = lower('boshea@jobzcafe.com')
    and app_context = 'boh'
  limit 1
),
comments(ticket_number, marker, body) as (
  values
    ('T-0194', '[codex-20260602-boh-shell-nav]',
$$[codex-20260602-boh-shell-nav]
BOH-dev progress: refreshed the BOH shell/dashboard navigation so routed BOH apps open inside the BOH content area where appropriate; fixed compact/full rail behavior, hover labels, Settings route handling, Back of House header return-to-dashboard behavior, external app new-tab routing, Website customer-app grouping, and customer app sort order. Build verified locally with npm.cmd run build.
Status: IN PROGRESS - BOH-dev implementation verified; production migration/release allocation still pending.$$),
    ('T-0189', '[codex-20260602-boh-login-visual]',
$$[codex-20260602-boh-login-visual]
BOH-dev progress: updated the BOH login screen visual treatment and Jobs Cafe wording while keeping the auth guard behavior separate from visual polish. Build verified locally with npm.cmd run build.
Status: IN PROGRESS - login visual polish complete locally; release allocation still pending.$$),
    ('T-0308', '[codex-20260602-cellar-boh-embed]',
$$[codex-20260602-cellar-boh-embed]
BOH-dev progress: embedded CELLAR into the BOH content area, removed the extra contextual BOH sidebar for the CELLAR wrapper, added BOH staff-session handoff support, and deployed the BOH-dev cellar_create_boh_embed_handoff function. Build verified locally with npm.cmd run build.
Status: IN PROGRESS - BOH-dev embed and handoff verified; BOH/prod promotion still pending.$$),
    ('T-0301', '[codex-20260602-slotz-calendar-sync]',
$$[codex-20260602-slotz-calendar-sync]
BOH-dev progress: fixed SLOTZ Outlook calendar sync coverage, enabled server-side calendar sync auth via scheduler secret, deployed slotz-calendar-sync to BOH-dev, and confirmed the pg_cron job slotz-calendar-sync-every-5-minutes is active. Build verified locally with npm.cmd run build.
Status: IN PROGRESS - BOH-dev sync path verified; BOH/prod smoke and release allocation still pending.$$),
    ('T-0309', '[codex-20260602-studio-cafe-offering]',
$$[codex-20260602-studio-cafe-offering]
BOH-dev progress: compacted Product Offering layout, fixed Menu Overview/Pipeline empty-state masking by surfacing initiative query errors, granted BOH-dev helper function execute permissions needed for Menu initiatives, and confirmed Cafe/Studio duplicate cleanup should keep Studio as the surviving app record.
Status: IN PROGRESS - BOH-dev UI and access fixes verified; Cafe-to-Studio DB consolidation and production migration still pending.$$)
)
insert into public.counter_ticket_comment (
  ticket_id,
  author_id,
  body,
  is_visible_to_requester,
  should_notify_requester,
  app_context
)
select t.id, author.id, comments.body, false, false, 'boh'
from comments
join public.counter_ticket t on t.ticket_number = comments.ticket_number
cross join author
where not exists (
  select 1
  from public.counter_ticket_comment existing
  where existing.ticket_id = t.id
    and existing.body like '%' || comments.marker || '%'
);

update public.counter_ticket t
set status_id = s.id,
    updated_at = now()
from public.counter_ticket_status s
where s.key = 'in_progress'
  and t.ticket_number in ('T-0301', 'T-0308', 'T-0309')
  and t.status_id is distinct from s.id;

commit;

select t.ticket_number, s.key as status_key, count(c.id) as comment_count
from public.counter_ticket t
left join public.counter_ticket_status s on s.id = t.status_id
left join public.counter_ticket_comment c on c.ticket_id = t.id
where t.ticket_number in ('T-0194','T-0189','T-0308','T-0301','T-0309')
group by t.ticket_number, s.key
order by t.ticket_number;
