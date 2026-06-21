-- 07_verify_alignment_and_majors.sql
-- Run after 06. Both result sets should be empty.

select
  version_number,
  count(distinct release_date) as release_candidate_dates,
  count(distinct rollout_date) as rollout_dates,
  count(distinct sprint_start_date) as sprint_start_dates,
  count(distinct sprint_end_date) as sprint_end_dates,
  count(distinct testing_start_date) as testing_start_dates,
  count(distinct testing_end_date) as testing_end_dates,
  count(distinct release_candidate_date) as release_candidate_field_dates
from public.boh_release_version
where release_tier = 'minor'
  and environment in ('internal', 'external')
  and nullif(trim(coalesce(version_number, '')), '') is not null
group by version_number
having count(distinct environment) > 1
   and (
     count(distinct release_date) > 1
     or count(distinct rollout_date) > 1
     or count(distinct sprint_start_date) > 1
     or count(distinct sprint_end_date) > 1
     or count(distinct testing_start_date) > 1
     or count(distinct testing_end_date) > 1
     or count(distinct release_candidate_date) > 1
   )
order by version_number;

select
  id,
  environment,
  version_number,
  version_label,
  release_date
from public.boh_release_version
where release_tier = 'major'
  and release_date is not null
  and to_char(release_date, 'MM-DD') not in ('01-31', '04-30', '07-31', '10-31')
order by release_date, environment, version_number;
