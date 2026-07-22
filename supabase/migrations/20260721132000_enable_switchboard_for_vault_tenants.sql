begin;

insert into public.boh_tenant_app(
  tenant_id,
  app_id,
  status,
  app_kind
)
select
  vault_tenant_app.tenant_id,
  switchboard_app.id,
  'enabled',
  'boh'
from public.boh_tenant_app vault_tenant_app
join public.boh_app vault_app
  on vault_app.id=vault_tenant_app.app_id
 and vault_app.slug='vault'
 and vault_app.app_context='boh'
 and vault_app.is_active
cross join public.boh_app switchboard_app
where vault_tenant_app.status in ('enabled','trial')
  and switchboard_app.slug='switchboard'
  and switchboard_app.app_context='boh'
  and switchboard_app.is_active
on conflict (tenant_id,app_id) do update set
  status='enabled',
  app_kind='boh';

commit;
