begin;

with target_ticket as (
  select id
  from public.counter_ticket
  where ticket_number = 'T-0058'
  limit 1
),
author as (
  select id
  from public.boh_user
  where app_context = 'boh'
  order by created_at asc
  limit 1
),
comment_body as (
  select $$[[slotz_outlook_tested_20260517]]
Status: CLOSED IN SOURCE - release allocation needed.

SLOTZ Outlook connection testing is complete and working in BOH-dev. The original ticket subject used the legacy Chatz name, but the implemented app path is now SLOTZ.

Completed:
- Confirmed Outlook authentication and reconnect flow works after Azure redirect and Supabase secret cleanup.
- Standardized SLOTZ frontend and Supabase Edge Function environment naming.
- Removed dev-only Test Connection and Last checked UI from Integrations.
- Cleaned Outlook integration messaging and button sizing.

Release allocation: not allocated.$$ as body
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
    tt.id,
    a.id,
    cb.body,
    false,
    false,
    'slotz',
    now()
  from target_ticket tt
  cross join author a
  cross join comment_body cb
  where not exists (
    select 1
    from public.counter_ticket_comment c
    where c.ticket_id = tt.id
      and c.body like '%[[slotz_outlook_tested_20260517]]%'
  )
  returning id
)
select
  case
    when not exists (select 1 from target_ticket) then 'missing ticket T-0058'
    when not exists (select 1 from author) then 'missing BOH author'
    when exists (select 1 from inserted) then 'comment added to T-0058'
    else 'comment already exists; no insert'
  end as result;

commit;
