-- 05_recalculate_minor_cycle_fields.sql
-- Run after 04. Minors inherit release year/cycle from parent majors.

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
