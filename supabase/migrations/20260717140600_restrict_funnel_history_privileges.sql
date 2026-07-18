-- Remove inherited browser privileges from append-only Funnel Opportunity history.
-- This migration intentionally does not modify BOH Vault tables, functions, or policies.

begin;

revoke all privileges on public.funnel_opportunity_stage_history from anon;
revoke all privileges on public.funnel_opportunity_stage_history from authenticated;
grant select on public.funnel_opportunity_stage_history to authenticated;

commit;
