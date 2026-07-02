-- BOH-DEV only: create Forge workstream for the first Australis rollout initiative.
-- This pushes only the bootstrap initiative into Forge execution planning.
-- Do not run against production.

begin;

do $$
declare
  australis_tenant_id uuid;
  bootstrap_initiative_id uuid;
  admin_user_id uuid;
  workstream_status_id uuid;
begin
  select id into australis_tenant_id from public.boh_tenant where slug = 'australis';

  if australis_tenant_id is null then
    raise exception 'Missing BOH tenant slug=australis.';
  end if;

  select id into bootstrap_initiative_id
  from public.boh_initiative
  where tenant_id = australis_tenant_id
    and title = 'Bootstrap Australis autonomous business foundation'
  limit 1;

  if bootstrap_initiative_id is null then
    raise exception 'Missing bootstrap initiative. Run 20260625_seed_australis_rollout_menu_initiatives_boh_dev.sql first.';
  end if;

  select id into admin_user_id
  from public.boh_user
  where lower(email) in ('admin@australis.cloud', 'jobzcafe.ai@gmail.com')
  order by case when lower(email) = 'admin@australis.cloud' then 1 else 2 end
  limit 1;

  select id into workstream_status_id
  from public.boh_workstream_status
  where is_active and key in ('draft', 'in_progress', 'approved')
  order by case key when 'draft' then 1 when 'in_progress' then 2 else 3 end
  limit 1;

  insert into public.boh_workstream (
    initiative_id, title, description, status_id, assigned_to, created_by, progress, tenant_id
  )
  select
    bootstrap_initiative_id,
    'Australis bootstrap and autonomous business foundation',
    'Forge workstream for confirming BOH Australis entity tenant, admin access, BOH billing/Patron entitlement model, Australis Supabase target, and hello@australis.cloud onboarding path before deeper Australis rollout.',
    workstream_status_id,
    admin_user_id,
    coalesce(admin_user_id, (select id from public.boh_user limit 1)),
    0,
    australis_tenant_id
  where not exists (
    select 1 from public.boh_workstream w
    where w.tenant_id = australis_tenant_id
      and w.initiative_id = bootstrap_initiative_id
      and w.title = 'Australis bootstrap and autonomous business foundation'
  );
end $$;

commit;

select
  i.title as initiative_title,
  w.title as workstream_title,
  ws.key as workstream_status_key,
  w.id::text as workstream_id
from public.boh_workstream w
join public.boh_initiative i on i.id = w.initiative_id
left join public.boh_workstream_status ws on ws.id = w.status_id
where w.tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and w.title = 'Australis bootstrap and autonomous business foundation';
