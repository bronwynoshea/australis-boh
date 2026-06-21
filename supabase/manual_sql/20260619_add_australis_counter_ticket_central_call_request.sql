-- BOH-DEV only: Australis-scoped Counter ticket for checkpoint 1 review blocker.

begin;

insert into public.counter_ticket (
  subject,
  description,
  category,
  app,
  requester_email,
  source,
  status_id,
  priority_id,
  app_context,
  tenant_id
)
select
  'Australis web Book a call flow references central-call-request',
  'Review of Australis checkpoint 1 found the visible web Book a call flow still posts to an unwired central-call-request Edge Function with Central naming. This should be renamed/wired to an Australis-owned function or hidden until implemented. Keep this bug under the Australis tenant/workspace, separate from JOBZCAFE records.',
  'bug',
  'Australis',
  'jobzcafe.ai@gmail.com',
  'kanban-review',
  (select id from public.counter_ticket_status where key in ('new', 'triage') order by case key when 'new' then 1 else 2 end limit 1),
  (select id from public.counter_ticket_priority where key in ('medium', 'high') order by case key when 'medium' then 1 else 2 end limit 1),
  'boh',
  (select id from public.boh_tenant where slug = 'australis')
where not exists (
  select 1
  from public.counter_ticket c
  where c.tenant_id = (select id from public.boh_tenant where slug = 'australis')
    and c.subject = 'Australis web Book a call flow references central-call-request'
);

commit;

select id::text, subject, category, app, requester_email
from public.counter_ticket
where tenant_id = (select id from public.boh_tenant where slug = 'australis')
  and subject = 'Australis web Book a call flow references central-call-request';
