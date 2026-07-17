-- Make Opportunity stage history trigger-owned and append-only for browser users.
-- This migration intentionally does not modify BOH Vault tables, functions, or policies.

begin;

alter function public.funnel_record_opportunity_stage_history() security definer;
alter function public.funnel_record_opportunity_stage_history() set search_path = public, private;

revoke all on function public.funnel_record_opportunity_stage_history() from public;
revoke all on function public.funnel_record_opportunity_stage_history() from anon;
revoke all on function public.funnel_record_opportunity_stage_history() from authenticated;

revoke insert, update, delete on public.funnel_opportunity_stage_history from authenticated;
grant select on public.funnel_opportunity_stage_history to authenticated;

drop policy if exists funnel_opportunity_history_insert on public.funnel_opportunity_stage_history;

commit;
