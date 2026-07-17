-- BOH-DEV only: enable Funnel for active development tenants after the feature migration.
-- Do not run in production without the matching billing/entitlement release decision.

update public.boh_tenant_app tenant_app
set status = 'enabled',
    updated_at = now()
from public.boh_app app,
     public.boh_tenant tenant
where tenant_app.app_id = app.id
  and tenant_app.tenant_id = tenant.id
  and app.slug = 'funnel'
  and tenant.status = 'active'
  and tenant_app.status = 'coming_soon';
