-- Backfill BOH production boh_user names from the legacy profile table.
-- Safe/idempotent: only updates rows where boh_user first/last are missing.
-- Needed while BOH production still carries legacy public.profile rows used by Loft identity.

with profile_names as (
  select
    bu.id as boh_user_id,
    coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')) as display_name
  from public.boh_user bu
  join public.profile p
    on p.id = bu.id
    or lower(p.email) = lower(bu.email)
  where coalesce(nullif(trim(bu.first_name), ''), nullif(trim(bu.last_name), '')) is null
), split_names as (
  select
    boh_user_id,
    display_name,
    case
      when display_name is null then null
      when array_length(regexp_split_to_array(display_name, '\s+'), 1) <= 1 then display_name
      else array_to_string((regexp_split_to_array(display_name, '\s+'))[1:greatest(array_length(regexp_split_to_array(display_name, '\s+'), 1) - 1, 1)], ' ')
    end as first_name,
    case
      when display_name is null then null
      when array_length(regexp_split_to_array(display_name, '\s+'), 1) <= 1 then null
      else (regexp_split_to_array(display_name, '\s+'))[array_length(regexp_split_to_array(display_name, '\s+'), 1)]
    end as last_name
  from profile_names
  where display_name is not null
)
update public.boh_user bu
set
  first_name = coalesce(nullif(trim(bu.first_name), ''), split_names.first_name),
  last_name = coalesce(nullif(trim(bu.last_name), ''), split_names.last_name),
  updated_at = now()
from split_names
where bu.id = split_names.boh_user_id
returning bu.id, bu.email, bu.first_name, bu.last_name;
