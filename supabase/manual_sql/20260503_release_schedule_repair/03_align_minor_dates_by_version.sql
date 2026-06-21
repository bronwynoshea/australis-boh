-- 03_align_minor_dates_by_version.sql
-- Run after 02. Uses corrected external minor rows as canonical.

with external_minor_schedule as (
  select distinct on (version_number)
    version_number,
    release_date,
    rollout_date,
    release_candidate_date,
    testing_start_date,
    testing_end_date,
    sprint_end_date,
    sprint_start_date
  from public.boh_release_version
  where release_tier = 'minor'
    and environment = 'external'
    and nullif(trim(coalesce(version_number, '')), '') is not null
  order by version_number, release_date nulls last, id
)
update public.boh_release_version as release
set
  release_date = external.release_date,
  rollout_date = external.rollout_date,
  release_candidate_date = external.release_candidate_date,
  testing_start_date = external.testing_start_date,
  testing_end_date = external.testing_end_date,
  sprint_end_date = external.sprint_end_date,
  sprint_start_date = external.sprint_start_date
from external_minor_schedule as external
where release.release_tier = 'minor'
  and release.environment <> 'external'
  and release.version_number = external.version_number;
