-- Backfill initiatives attached to released major releases.
--
-- Forge treats a released major release as completed/historical. The linked
-- initiatives should agree with that state so release views, reports, and
-- downstream agent handoff summaries do not show released scope as still planned.

update public.boh_initiative as initiative
set
  status = 'done',
  progress = 100,
  updated_at = now()
from public.boh_release_version as release
where initiative.major_release_id = release.id
  and lower(coalesce(release.release_tier::text, '')) = 'major'
  and lower(coalesce(release.status::text, '')) = 'released'
  and lower(coalesce(initiative.status::text, '')) <> 'cancelled'
  and (
    lower(coalesce(initiative.status::text, '')) <> 'done'
    or initiative.progress is distinct from 100
  );
