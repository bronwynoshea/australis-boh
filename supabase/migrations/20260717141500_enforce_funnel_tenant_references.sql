-- Enforce tenant consistency for Funnel actor and stage-history references.
-- This migration intentionally does not modify BOH Vault tables, functions, or policies.

begin;

create or replace function public.funnel_actor_is_active_tenant_member(
  target_user_id uuid,
  target_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is null or exists (
    select 1
    from public.boh_tenant_member member
    join public.boh_user app_user on app_user.id = member.user_id
    where member.user_id = target_user_id
      and member.tenant_id = target_tenant_id
      and member.membership_status = 'active'
      and app_user.status = 'active'
  )
$$;

create or replace function public.funnel_validate_actor_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb := to_jsonb(new);
  field_name text;
  actor_id uuid;
begin
  foreach field_name in array array['owner_id', 'created_by', 'updated_by', 'changed_by'] loop
    actor_id := nullif(row_data ->> field_name, '')::uuid;
    if actor_id is not null
       and not public.funnel_actor_is_active_tenant_member(actor_id, new.tenant_id) then
      raise exception '% must reference an active member of the same tenant', field_name;
    end if;
  end loop;

  return new;
end
$$;

create or replace function public.funnel_validate_history_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_funnel_id uuid;
  opportunity_tenant_id uuid;
  next_stage_funnel_id uuid;
  next_stage_tenant_id uuid;
  previous_stage_funnel_id uuid;
  previous_stage_tenant_id uuid;
begin
  select opportunity.funnel_id, opportunity.tenant_id
    into opportunity_funnel_id, opportunity_tenant_id
  from public.funnel_opportunity opportunity
  where opportunity.id = new.opportunity_id;

  select stage.funnel_id, stage.tenant_id
    into next_stage_funnel_id, next_stage_tenant_id
  from public.funnel_opportunity_stage stage
  where stage.id = new.next_stage_id;

  if new.previous_stage_id is not null then
    select stage.funnel_id, stage.tenant_id
      into previous_stage_funnel_id, previous_stage_tenant_id
    from public.funnel_opportunity_stage stage
    where stage.id = new.previous_stage_id;
  end if;

  if opportunity_tenant_id is distinct from new.tenant_id
     or next_stage_tenant_id is distinct from new.tenant_id
     or next_stage_funnel_id is distinct from opportunity_funnel_id
     or (new.previous_stage_id is not null and (
       previous_stage_tenant_id is distinct from new.tenant_id
       or previous_stage_funnel_id is distinct from opportunity_funnel_id
     )) then
    raise exception 'History stages must belong to the same tenant and Funnel';
  end if;

  return new;
end
$$;

drop trigger if exists funnel_actor_references_validate on public.funnel;
create trigger funnel_actor_references_validate
before insert or update on public.funnel
for each row execute function public.funnel_validate_actor_references();

drop trigger if exists funnel_journey_stage_actor_references_validate on public.funnel_journey_stage;
create trigger funnel_journey_stage_actor_references_validate
before insert or update on public.funnel_journey_stage
for each row execute function public.funnel_validate_actor_references();

drop trigger if exists funnel_opportunity_actor_references_validate on public.funnel_opportunity;
create trigger funnel_opportunity_actor_references_validate
before insert or update on public.funnel_opportunity
for each row execute function public.funnel_validate_actor_references();

drop trigger if exists funnel_history_references_validate on public.funnel_opportunity_stage_history;
create trigger funnel_history_references_validate
before insert or update on public.funnel_opportunity_stage_history
for each row execute function public.funnel_validate_history_references();

drop trigger if exists funnel_history_actor_references_validate on public.funnel_opportunity_stage_history;
create trigger funnel_history_actor_references_validate
before insert or update on public.funnel_opportunity_stage_history
for each row execute function public.funnel_validate_actor_references();

revoke all on function public.funnel_actor_is_active_tenant_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.funnel_validate_actor_references() from public, anon, authenticated;
revoke all on function public.funnel_validate_history_references() from public, anon, authenticated;

commit;
