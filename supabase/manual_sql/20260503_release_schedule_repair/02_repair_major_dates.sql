-- 02_repair_major_dates.sql
-- Run after 01. Scope: public.boh_release_version only.

with major_repair as (
  select
    id,
    case
      when release_date is null then null::date
      when extract(month from release_date)::int between 1 and 3
        then make_date(extract(year from release_date)::int, 1, 31)
      when extract(month from release_date)::int between 4 and 6
        then make_date(extract(year from release_date)::int, 4, 30)
      when extract(month from release_date)::int between 7 and 9
        then make_date(extract(year from release_date)::int, 7, 31)
      else make_date(extract(year from release_date)::int, 10, 31)
    end as candidate_date
  from public.boh_release_version
  where release_tier = 'major'
),
major_schedule as (
  select
    id,
    candidate_date,
    case
      when ((8 - extract(dow from candidate_date)::int) % 7) = 0
        then candidate_date + interval '7 days'
      else candidate_date + (((8 - extract(dow from candidate_date)::int) % 7) * interval '1 day')
    end::date as rollout_date
  from major_repair
  where candidate_date is not null
)
update public.boh_release_version as release
set
  release_date = schedule.candidate_date,
  rollout_date = schedule.rollout_date,
  release_candidate_date = schedule.candidate_date,
  testing_start_date = (schedule.candidate_date - interval '1 day')::date,
  testing_end_date = (schedule.candidate_date - interval '1 day')::date,
  sprint_end_date = (schedule.candidate_date - interval '2 days')::date,
  sprint_start_date = (schedule.candidate_date - interval '11 days')::date
from major_schedule as schedule
where release.id = schedule.id;
