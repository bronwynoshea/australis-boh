-- Disable JOBZCAFE® Studio/Talent customer workspace links for the Australis tenant.
-- Australis BOH should expose Australis BOH capabilities only; Studio and Talent are JOBZCAFE® customer products.

update public.boh_tenant_app ta
set status = 'disabled',
    updated_at = now(),
    metadata = coalesce(ta.metadata, '{}'::jsonb) || jsonb_build_object(
      'disabled_reason', 'Australis BOH does not expose JOBZCAFE Studio/Talent workspace links',
      'disabled_by', '20260623_disable_australis_studio_talent_workspace_links'
    )
from public.boh_tenant t
join public.boh_app a on a.slug in ('studio', 'talent')
where ta.tenant_id = t.id
  and ta.app_id = a.id
  and t.slug = 'australis'
  and ta.status <> 'disabled';

select t.slug as tenant_slug,
       a.slug as app_slug,
       ta.status,
       ta.app_kind,
       ta.updated_at
from public.boh_tenant_app ta
join public.boh_tenant t on t.id = ta.tenant_id
join public.boh_app a on a.id = ta.app_id
where t.slug = 'australis'
  and a.slug in ('studio', 'talent')
order by a.slug;
