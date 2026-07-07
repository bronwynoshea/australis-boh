-- Keep Loft tenant-native inside BOH instead of launching retired standalone Loft hostnames.
update boh_app
set route = '/apps/loft',
    type = 'internal_tool',
    external_url = null
where slug = 'loft';

update boh_tenant_app ta
set app_kind = 'boh',
    launch_route = '/apps/loft',
    external_url = null
from boh_app a
where ta.app_id = a.id
  and a.slug = 'loft';
