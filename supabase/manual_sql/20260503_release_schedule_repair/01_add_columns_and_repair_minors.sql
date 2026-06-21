-- 01_add_columns_and_repair_minors.sql
-- Run first in BOH dev. Scope: public.boh_release_version only.

alter table public.boh_release_version
  add column if not exists rollout_date date,
  add column if not exists sprint_start_date date,
  add column if not exists sprint_end_date date,
  add column if not exists testing_start_date date,
  add column if not exists testing_end_date date,
  add column if not exists release_candidate_date date;

-- If a minor release_date was accidentally set to Monday rollout,
-- move release_date back to the previous Friday.
with minor_repair as (
  select
    id,
    case
      when release_date is null then null::date
      when extract(dow from release_date)::int = 1 then release_date - interval '3 days'
      else release_date
    end::date as candidate_date
  from public.boh_release_version
  where release_tier = 'minor'
)
update public.boh_release_version as release
set
  release_date = repair.candidate_date,
  rollout_date = (repair.candidate_date + interval '3 days')::date,
  release_candidate_date = repair.candidate_date,
  testing_start_date = (repair.candidate_date - interval '1 day')::date,
  testing_end_date = (repair.candidate_date - interval '1 day')::date,
  sprint_end_date = (repair.candidate_date - interval '2 days')::date,
  sprint_start_date = (repair.candidate_date - interval '11 days')::date
from minor_repair as repair
where release.id = repair.id
  and repair.candidate_date is not null;
