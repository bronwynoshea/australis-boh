-- BOH-DEV only: correct Australis rollout wording after confirming Rocket is JOBZCAFE®-specific.
-- Do not run against production.

begin;

update public.boh_initiative
set title = 'BOH adapters and future Australis agent orchestration',
    description = 'Connect Australis to BOH operating sources and define future Australis business-manager/product agent review, assignment, and update workflows across Menu, Forge, Counter, Tablez/Chairz, and agents after hello@australis.cloud onboarding creates the Australis agent team.',
    purpose = 'Connect Australis to BOH operating sources and define future Australis business-manager/product agent review, assignment, and update workflows across Menu, Forge, Counter, Tablez/Chairz, and agents after hello@australis.cloud onboarding creates the Australis agent team.',
    tags = array['boh-adapter','australis-agents','forge','menu'],
    updated_at = now()
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and title = 'BOH adapters and Rocket orchestration';

commit;

select title, description, tags::text
from public.boh_initiative
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and title in ('BOH adapters and Rocket orchestration', 'BOH adapters and future Australis agent orchestration')
order by title;
