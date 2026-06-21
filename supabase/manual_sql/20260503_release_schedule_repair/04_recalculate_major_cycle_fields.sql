-- 04_recalculate_major_cycle_fields.sql
-- Run after 03. Recalculates major year/quarter/cycle fields.

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
