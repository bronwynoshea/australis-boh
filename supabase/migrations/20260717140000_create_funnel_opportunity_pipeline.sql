-- Funnel-owned customer journeys and sales Opportunity pipeline.
-- This migration intentionally does not modify BOH Vault tables, functions, or policies.

begin;

insert into public.boh_app (
  id,
  name,
  slug,
  description,
  route,
  external_url,
  primary_color,
  type,
  is_active,
  app_context,
  created_at
)
values (
  gen_random_uuid(),
  'Funnel',
  'funnel',
  'Customer journeys, sales opportunities, milestones, forecasting, and Cookbook asset requirements',
  '/funnel',
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
    type = excluded.type,
    is_active = true,
    app_context = 'boh';

create table if not exists public.funnel (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  funnel_key text not null,
  name text not null,
  description text,
  conversion_objective text,
  status text not null default 'draft'
    check (status in ('draft', 'planning', 'in_production', 'ready_for_review', 'ready_to_launch', 'active', 'paused', 'completed', 'archived')),
  owner_id uuid references public.boh_user(id) on delete set null,
  planned_start_date date,
  planned_end_date date,
  created_by uuid references public.boh_user(id) on delete set null,
  updated_by uuid references public.boh_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, funnel_key),
  unique (id, tenant_id)
);

create table if not exists public.funnel_journey_stage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  funnel_id uuid not null,
  stage_key text not null,
  label text not null,
  purpose text,
  sort_order integer not null check (sort_order > 0),
  entry_condition text,
  completion_condition text,
  conversion_objective text,
  call_to_action text,
  owner_id uuid references public.boh_user(id) on delete set null,
  readiness_state text not null default 'not_ready'
    check (readiness_state in ('not_ready', 'blocked', 'in_progress', 'ready', 'approved')),
  is_optional boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_id, stage_key),
  unique (id, funnel_id, tenant_id),
  foreign key (funnel_id, tenant_id)
    references public.funnel(id, tenant_id) on delete cascade
);

create table if not exists public.funnel_opportunity_stage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  funnel_id uuid not null,
  stage_key text not null,
  label text not null,
  reportable_milestone text not null,
  exit_criteria text not null,
  default_probability numeric(5,2) not null check (default_probability between 0 and 100),
  sort_order integer not null check (sort_order > 0),
  stage_type text not null default 'open' check (stage_type in ('open', 'won', 'lost')),
  is_optional boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_id, stage_key),
  unique (id, funnel_id, tenant_id),
  foreign key (funnel_id, tenant_id)
    references public.funnel(id, tenant_id) on delete cascade
);

create table if not exists public.funnel_opportunity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  funnel_id uuid not null,
  stage_id uuid not null,
  primary_organisation_id uuid references public.patron_organisation(id) on delete set null,
  name text not null,
  description text,
  value_amount numeric(18,2) not null default 0 check (value_amount >= 0),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  probability_override numeric(5,2) check (probability_override between 0 and 100),
  owner_id uuid references public.boh_user(id) on delete set null,
  expected_close_date date,
  next_action text,
  next_action_due_at timestamptz,
  source text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  outcome_reason text,
  competitor_name text,
  reentry_date date,
  created_by uuid references public.boh_user(id) on delete set null,
  updated_by uuid references public.boh_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (funnel_id, tenant_id)
    references public.funnel(id, tenant_id) on delete cascade,
  foreign key (stage_id, funnel_id, tenant_id)
    references public.funnel_opportunity_stage(id, funnel_id, tenant_id)
);

create table if not exists public.funnel_opportunity_person (
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  opportunity_id uuid not null,
  person_id uuid not null references public.patron_person(id) on delete cascade,
  relationship_role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, person_id),
  foreign key (opportunity_id, tenant_id)
    references public.funnel_opportunity(id, tenant_id) on delete cascade
);

create table if not exists public.funnel_opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  opportunity_id uuid not null,
  previous_stage_id uuid references public.funnel_opportunity_stage(id) on delete set null,
  next_stage_id uuid not null references public.funnel_opportunity_stage(id),
  probability_before numeric(5,2),
  probability_after numeric(5,2) not null,
  milestone_evidence text,
  change_reason text,
  next_action text,
  changed_by uuid references public.boh_user(id) on delete set null,
  changed_at timestamptz not null default now(),
  foreign key (opportunity_id, tenant_id)
    references public.funnel_opportunity(id, tenant_id) on delete cascade
);

create index if not exists funnel_tenant_status_idx
  on public.funnel(tenant_id, status, updated_at desc);
create index if not exists funnel_journey_stage_funnel_idx
  on public.funnel_journey_stage(funnel_id, sort_order);
create index if not exists funnel_opportunity_stage_funnel_idx
  on public.funnel_opportunity_stage(funnel_id, sort_order);
create index if not exists funnel_opportunity_pipeline_idx
  on public.funnel_opportunity(tenant_id, funnel_id, stage_id, status);
create index if not exists funnel_opportunity_owner_idx
  on public.funnel_opportunity(tenant_id, owner_id, next_action_due_at);
create index if not exists funnel_opportunity_organisation_idx
  on public.funnel_opportunity(tenant_id, primary_organisation_id);
create index if not exists funnel_opportunity_person_person_idx
  on public.funnel_opportunity_person(tenant_id, person_id);
create index if not exists funnel_opportunity_history_idx
  on public.funnel_opportunity_stage_history(opportunity_id, changed_at desc);

create or replace function public.funnel_has_tenant_access(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.boh_user u
    join public.boh_tenant_member m
      on m.user_id = u.id
     and m.tenant_id = target_tenant_id
     and m.membership_status = 'active'
    join public.boh_tenant t
      on t.id = m.tenant_id
     and t.status = 'active'
    join public.boh_app a
      on a.slug = 'funnel'
     and a.is_active = true
    join public.boh_tenant_app ta
      on ta.tenant_id = m.tenant_id
     and ta.app_id = a.id
     and ta.status in ('enabled', 'trial')
    where u.id = private.current_boh_user_id()
      and u.status = 'active'
  )
$$;

create or replace function public.funnel_validate_opportunity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_stage_type text;
  organisation_tenant_id uuid;
begin
  select stage_type
  into selected_stage_type
  from public.funnel_opportunity_stage
  where id = new.stage_id
    and funnel_id = new.funnel_id
    and tenant_id = new.tenant_id;

  if selected_stage_type is null then
    raise exception 'Opportunity stage must belong to the same Funnel and tenant';
  end if;

  if new.primary_organisation_id is not null then
    select tenant_id
    into organisation_tenant_id
    from public.patron_organisation
    where id = new.primary_organisation_id;

    if organisation_tenant_id is distinct from new.tenant_id then
      raise exception 'Patron organisation must belong to the same tenant';
    end if;
  end if;

  if selected_stage_type = 'won' then
    new.status := 'won';
  elsif selected_stage_type = 'lost' then
    new.status := 'lost';
    if nullif(btrim(new.outcome_reason), '') is null then
      raise exception 'Closed Lost requires an outcome reason';
    end if;
  else
    new.status := 'open';
  end if;

  new.updated_at := now();
  return new;
end
$$;

create or replace function public.funnel_record_opportunity_stage_history()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  before_probability numeric(5,2);
  after_probability numeric(5,2);
begin
  if tg_op = 'UPDATE' and old.stage_id = new.stage_id then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(old.probability_override, default_probability)
    into before_probability
    from public.funnel_opportunity_stage
    where id = old.stage_id;
  end if;

  select coalesce(new.probability_override, default_probability)
  into after_probability
  from public.funnel_opportunity_stage
  where id = new.stage_id;

  insert into public.funnel_opportunity_stage_history (
    tenant_id,
    opportunity_id,
    previous_stage_id,
    next_stage_id,
    probability_before,
    probability_after,
    change_reason,
    next_action,
    changed_by
  ) values (
    new.tenant_id,
    new.id,
    case when tg_op = 'UPDATE' then old.stage_id else null end,
    new.stage_id,
    before_probability,
    after_probability,
    case when tg_op = 'INSERT' then 'Opportunity created' else 'Stage changed' end,
    new.next_action,
    coalesce(new.updated_by, new.created_by, private.current_boh_user_id())
  );

  return new;
end
$$;

drop trigger if exists funnel_opportunity_validate on public.funnel_opportunity;
create trigger funnel_opportunity_validate
before insert or update on public.funnel_opportunity
for each row execute function public.funnel_validate_opportunity();

drop trigger if exists funnel_opportunity_stage_history on public.funnel_opportunity;
create trigger funnel_opportunity_stage_history
after insert or update of stage_id on public.funnel_opportunity
for each row execute function public.funnel_record_opportunity_stage_history();

create or replace function public.funnel_validate_person_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  person_tenant_id uuid;
begin
  select tenant_id into person_tenant_id
  from public.patron_person
  where id = new.person_id;

  if person_tenant_id is distinct from new.tenant_id then
    raise exception 'Patron person must belong to the same tenant';
  end if;

  return new;
end
$$;

drop trigger if exists funnel_opportunity_person_validate on public.funnel_opportunity_person;
create trigger funnel_opportunity_person_validate
before insert or update on public.funnel_opportunity_person
for each row execute function public.funnel_validate_person_link();

insert into public.funnel (
  tenant_id,
  funnel_key,
  name,
  description,
  conversion_objective,
  status
)
select
  t.id,
  'sales_pipeline',
  'Sales Pipeline',
  'Reportable commercial Opportunities linked to Patron people and organisations.',
  'Move qualified Opportunities to a binding purchase outcome.',
  'active'
from public.boh_tenant t
where t.status = 'active'
on conflict (tenant_id, funnel_key) do nothing;

insert into public.funnel_opportunity_stage (
  tenant_id,
  funnel_id,
  stage_key,
  label,
  reportable_milestone,
  exit_criteria,
  default_probability,
  sort_order,
  stage_type,
  is_optional
)
select
  f.tenant_id,
  f.id,
  stage.stage_key,
  stage.label,
  stage.reportable_milestone,
  stage.exit_criteria,
  stage.default_probability,
  stage.sort_order,
  stage.stage_type,
  stage.is_optional
from public.funnel f
cross join (
  values
    ('lead_identified', 'Lead Identified', 'Lead fits the agreed ideal customer profile.', 'Potential customer fits the agreed ideal customer profile.', 2.00::numeric, 10, 'open', false),
    ('qualified_lead', 'Qualified Lead', 'Need and commercial path are qualified.', 'Need is validated, authority or the commercial path is identified, and timing is understood. Full BANT may be required by tenant policy.', 10.00::numeric, 20, 'open', false),
    ('discovery_complete', 'Discovery Complete', 'Business discovery is recorded.', 'Requirements, constraints, stakeholders, and desired outcomes are understood and recorded.', 20.00::numeric, 30, 'open', false),
    ('solution_fit_validated', 'Solution Fit Validated', 'Customer validates solution fit.', 'Customer agrees that the proposed solution addresses the recorded requirements.', 35.00::numeric, 40, 'open', false),
    ('demonstration_poc', 'Demonstration / Proof of Concept', 'Required demonstration or proof is complete.', 'Required demonstration, pilot, or proof step is completed successfully.', 50.00::numeric, 50, 'open', true),
    ('proposal_submitted', 'Proposal Submitted', 'Commercial proposal is delivered.', 'Commercial proposal is delivered and receipt is recorded.', 65.00::numeric, 60, 'open', false),
    ('negotiation', 'Negotiation', 'Commercial terms are active.', 'Pricing, legal, security, procurement, or contract terms are actively being resolved.', 80.00::numeric, 70, 'open', false),
    ('verbal_commitment', 'Verbal Commitment', 'Customer indicates intent to purchase.', 'Customer indicates intent to purchase, subject to final execution. This is not Closed Won.', 95.00::numeric, 80, 'open', false),
    ('closed_won', 'Closed Won', 'Binding purchase event is complete.', 'Contract, accepted order, or another tenant-defined binding purchase event is completed.', 100.00::numeric, 90, 'won', false),
    ('closed_lost', 'Closed Lost', 'Opportunity closed without purchase.', 'Opportunity is closed without purchase and a loss reason is recorded.', 0.00::numeric, 100, 'lost', false)
) as stage(stage_key, label, reportable_milestone, exit_criteria, default_probability, sort_order, stage_type, is_optional)
where f.funnel_key = 'sales_pipeline'
on conflict (funnel_id, stage_key) do update
set label = excluded.label,
    reportable_milestone = excluded.reportable_milestone,
    exit_criteria = excluded.exit_criteria,
    default_probability = excluded.default_probability,
    sort_order = excluded.sort_order,
    stage_type = excluded.stage_type,
    is_optional = excluded.is_optional,
    is_active = true,
    updated_at = now();

alter table public.funnel enable row level security;
alter table public.funnel_journey_stage enable row level security;
alter table public.funnel_opportunity_stage enable row level security;
alter table public.funnel_opportunity enable row level security;
alter table public.funnel_opportunity_person enable row level security;
alter table public.funnel_opportunity_stage_history enable row level security;

create policy funnel_select on public.funnel
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_insert on public.funnel
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_update on public.funnel
  for update to authenticated using (public.funnel_has_tenant_access(tenant_id))
  with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_delete on public.funnel
  for delete to authenticated using (public.funnel_has_tenant_access(tenant_id));

create policy funnel_journey_stage_select on public.funnel_journey_stage
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_journey_stage_insert on public.funnel_journey_stage
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_journey_stage_update on public.funnel_journey_stage
  for update to authenticated using (public.funnel_has_tenant_access(tenant_id))
  with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_journey_stage_delete on public.funnel_journey_stage
  for delete to authenticated using (public.funnel_has_tenant_access(tenant_id));

create policy funnel_opportunity_stage_select on public.funnel_opportunity_stage
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_stage_insert on public.funnel_opportunity_stage
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_stage_update on public.funnel_opportunity_stage
  for update to authenticated using (public.funnel_has_tenant_access(tenant_id))
  with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_stage_delete on public.funnel_opportunity_stage
  for delete to authenticated using (public.funnel_has_tenant_access(tenant_id));

create policy funnel_opportunity_select on public.funnel_opportunity
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_insert on public.funnel_opportunity
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_update on public.funnel_opportunity
  for update to authenticated using (public.funnel_has_tenant_access(tenant_id))
  with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_delete on public.funnel_opportunity
  for delete to authenticated using (public.funnel_has_tenant_access(tenant_id));

create policy funnel_opportunity_person_select on public.funnel_opportunity_person
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_person_insert on public.funnel_opportunity_person
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_person_update on public.funnel_opportunity_person
  for update to authenticated using (public.funnel_has_tenant_access(tenant_id))
  with check (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_person_delete on public.funnel_opportunity_person
  for delete to authenticated using (public.funnel_has_tenant_access(tenant_id));

create policy funnel_opportunity_history_select on public.funnel_opportunity_stage_history
  for select to authenticated using (public.funnel_has_tenant_access(tenant_id));
create policy funnel_opportunity_history_insert on public.funnel_opportunity_stage_history
  for insert to authenticated with check (public.funnel_has_tenant_access(tenant_id));

grant select, insert, update, delete on public.funnel to authenticated;
grant select, insert, update, delete on public.funnel_journey_stage to authenticated;
grant select, insert, update, delete on public.funnel_opportunity_stage to authenticated;
grant select, insert, update, delete on public.funnel_opportunity to authenticated;
grant select, insert, update, delete on public.funnel_opportunity_person to authenticated;
grant select, insert on public.funnel_opportunity_stage_history to authenticated;
grant execute on function public.funnel_has_tenant_access(uuid) to authenticated;

commit;
