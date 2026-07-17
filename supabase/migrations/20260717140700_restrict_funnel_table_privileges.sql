-- Limit Funnel browser roles to row-level DML so TRUNCATE cannot bypass RLS.
-- This migration intentionally does not modify BOH Vault tables, functions, or policies.

begin;

revoke all privileges on
  public.funnel,
  public.funnel_journey_stage,
  public.funnel_opportunity_stage,
  public.funnel_opportunity,
  public.funnel_opportunity_person,
  public.funnel_opportunity_stage_history
from anon, authenticated;

grant select, insert, update, delete on
  public.funnel,
  public.funnel_journey_stage,
  public.funnel_opportunity_stage,
  public.funnel_opportunity,
  public.funnel_opportunity_person
 to authenticated;

grant select on public.funnel_opportunity_stage_history to authenticated;

commit;
