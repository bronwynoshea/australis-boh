-- BOH-DEV only: enable Funnel for active development tenants after the feature migration.
-- Do not run in production without the matching billing/entitlement release decision.

insert into public.boh_tenant_app (
  tenant_id,
  app_id,
  status,
  app_kind,
  display_name,
  launch_route
)
select
  tenant.id,
  app.id,
  'enabled',
  'boh',
  app.name,
  app.route
from public.boh_tenant tenant
cross join public.boh_app app
where tenant.status = 'active'
  and app.slug = 'funnel'
on conflict (tenant_id, app_id) do update
set status = 'enabled',
    display_name = excluded.display_name,
    launch_route = excluded.launch_route,
    updated_at = now();
