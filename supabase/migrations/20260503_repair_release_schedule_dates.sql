-- Repair BOH Forge release schedule dates.
--
-- Scope:
-- - public.boh_release_version only.
-- - Does not touch central_* tables.
--
-- Semantics:
-- - Minor release_date is the Friday release candidate / code-complete date.
-- - Minor rollout_date is the following Monday.
-- - Minor sprint starts Monday, ends Wednesday.
-- - Minor agent + human testing is Thursday.
-- - Major release_date uses the quarter-end release candidate dates:
--   Q1 Jan 31, Q2 Apr 30, Q3 Jul 31, Q4 Oct 31.

alter table public.boh_release_version
  add column if not exists rollout_date date,
  add column if not exists sprint_start_date date,
  add column if not exists sprint_end_date date,
  add column if not exists testing_start_date date,
  add column if not exists testing_end_date date,
  add column if not exists release_candidate_date date;

-- 1. Repair minor rows on their own current dates first.
-- If release_date was accidentally set to Monday rollout, move it back to
-- the previous Friday. Friday release dates are preserved.
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

-- 2. Repair major release candidate dates to fixed quarter-end dates.
-- The quarter is inferred from the current date bucket so a Monday rollout
-- date just after quarter-end still maps to that quarter.
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

-- 3. Align internal/external minor rows by version_number using the corrected
-- external row as canonical.
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

-- 4. Recalculate year / quarter / cycle fields.
-- Majors derive their release cycle from their fixed release candidate date.
with major_cycle as (
  select
    id,
    extract(year from release_date)::int as release_year,
    case
      when extract(month from release_date)::int between 1 and 3 then 'Q1'
      when extract(month from release_date)::int between 4 and 6 then 'Q2'
      when extract(month from release_date)::int between 7 and 9 then 'Q3'
      else 'Q4'
    end as release_quarter
  from public.boh_release_version
  where release_tier = 'major'
    and release_date is not null
)
update public.boh_release_version as release
set
  year = cycle.release_year,
  quarter = cycle.release_quarter,
  cycle = cycle.release_year::text || ' - ' || cycle.release_quarter,
  release_year = cycle.release_year,
  release_cycle = cycle.release_quarter,
  sort_date = release.release_date
from major_cycle as cycle
where release.id = cycle.id;

-- Minors inherit release year / cycle from their parent major release.
with minor_cycle as (
  select
    minor.id,
    coalesce(parent.release_year, extract(year from minor.release_date)::int) as release_year,
    coalesce(
      parent.release_cycle,
      case
        when extract(month from minor.release_date)::int between 1 and 3 then 'Q1'
        when extract(month from minor.release_date)::int between 4 and 6 then 'Q2'
        when extract(month from minor.release_date)::int between 7 and 9 then 'Q3'
        else 'Q4'
      end
    ) as release_quarter
  from public.boh_release_version as minor
  left join public.boh_release_version as parent
    on parent.id = minor.parent_major_release_id
  where minor.release_tier = 'minor'
    and minor.release_date is not null
)
update public.boh_release_version as release
set
  year = cycle.release_year,
  quarter = cycle.release_quarter,
  cycle = cycle.release_year::text || ' - ' || cycle.release_quarter,
  release_year = cycle.release_year,
  release_cycle = cycle.release_quarter,
  sort_date = release.release_date
from minor_cycle as cycle
where release.id = cycle.id;

-- Verification 1: any minor release_date not Friday.
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

-- Verification 2: any minor rollout_date not Monday.
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

-- Verification 3: any minor sprint_start_date not Monday.
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

-- Verification 4: any minor sprint_end_date not Wednesday.
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

-- Verification 5: any minor testing_start_date not Thursday.
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

-- Verification 6: any internal/external minor version_number date mismatch.
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

-- Verification 7: any major not on Jan 31, Apr 30, Jul 31, or Oct 31.
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
