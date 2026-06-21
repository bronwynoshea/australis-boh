-- 06_verify_minor_weekdays.sql
-- Run after 05. All result sets should be empty.

select
  id,
  environment,
  version_number,
  version_label,
  release_date
from public.boh_release_version
where release_tier = 'minor'
  and release_date is not null
  and extract(dow from release_date)::int <> 5
order by release_date, environment, version_number;

select
  id,
  environment,
  version_number,
  version_label,
  rollout_date
from public.boh_release_version
where release_tier = 'minor'
  and rollout_date is not null
  and extract(dow from rollout_date)::int <> 1
order by rollout_date, environment, version_number;

select
  id,
  environment,
  version_number,
  version_label,
  sprint_start_date
from public.boh_release_version
where release_tier = 'minor'
  and sprint_start_date is not null
  and extract(dow from sprint_start_date)::int <> 1
order by sprint_start_date, environment, version_number;

select
  id,
  environment,
  version_number,
  version_label,
  sprint_end_date
from public.boh_release_version
where release_tier = 'minor'
  and sprint_end_date is not null
  and extract(dow from sprint_end_date)::int <> 3
order by sprint_end_date, environment, version_number;

select
  id,
  environment,
  version_number,
  version_label,
  testing_start_date
from public.boh_release_version
where release_tier = 'minor'
  and testing_start_date is not null
  and extract(dow from testing_start_date)::int <> 4
order by testing_start_date, environment, version_number;
