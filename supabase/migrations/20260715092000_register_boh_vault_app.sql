-- Registry only: installing the schema does not entitle any tenant or infer any
-- user's Vault access from a broad BOH role. BOH-DEV enablement/grants are a
-- separate, deliberate, rollback-default manual operation.
begin;

insert into public.boh_app (
  id, name, slug, description, route, external_url, primary_color,
  type, is_active, app_context, created_at
)
values (
  gen_random_uuid(),
  'Vault',
  'vault',
  'Tenant-scoped protected-field, deployment-target, synchronization, and audit control plane.',
  '/vault',
  null,
  null,
  'internal_tool',
  true,
  'boh',
  now()
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    route = excluded.route,
    external_url = null,
    type = 'internal_tool',
    is_active = true,
    app_context = 'boh';

commit;
