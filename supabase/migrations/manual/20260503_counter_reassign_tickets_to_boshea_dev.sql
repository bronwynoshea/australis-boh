begin;

with users as (
  select
    (select id from public.boh_user where lower(email) = lower('boshea@jobzcafe.com') and app_context = 'boh' limit 1) as boshea_user_id,
    (select id from public.boh_user where lower(email) = lower('drmary@empathea.com') and app_context = 'boh' limit 1) as mary_user_id
),
guard as (
  select
    boshea_user_id,
    mary_user_id
  from users
  where boshea_user_id is not null
    and mary_user_id is not null
    and boshea_user_id <> mary_user_id
),
updated as (
  update public.counter_ticket t
  set
    assigned_to = guard.boshea_user_id,
    updated_at = now()
  from guard
  where t.assigned_to is null
     or t.assigned_to = guard.mary_user_id
  returning t.id
)
select count(*) as reassigned_ticket_count from updated;

commit;
