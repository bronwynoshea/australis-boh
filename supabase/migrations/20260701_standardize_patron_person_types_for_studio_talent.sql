-- Standardize Patron person type keys for JOBZCAFE® app families.
-- Studio/Cafe/Journey/Coach/Mentor/DNA are job seeker apps.
-- Talent is the recruiter workspace. Do not use talent_user for job seekers.
-- NOTE: patron_person_type.key is globally unique in current BOH-dev, so these keys are seeded once under the JOBZCAFE® tenant.

with jobzcafe_tenant as (
  select id
  from public.boh_tenant
  where slug = 'jobzcafe'
  limit 1
)
insert into public.patron_person_type (tenant_id, key, label, description, is_internal, is_active, sort_order)
select jt.id, v.key, v.label, v.description, v.is_internal, true, v.sort_order
from jobzcafe_tenant jt
cross join (
  values
    ('job_seeker', 'Job Seeker', 'Person using Studio/Cafe/Journey/Coach/Mentor/DNA job seeker apps.', false, 35),
    ('recruiter', 'Recruiter', 'Person using Talent recruiter workspace or recruiter-side workflows.', false, 45)
) as v(key, label, description, is_internal, sort_order)
where not exists (
  select 1
  from public.patron_person_type existing
  where existing.key = v.key
);

comment on table public.patron_person_type is
  'Patron person categories. Studio/Cafe/Journey/Coach/Mentor/DNA users are job_seeker; Talent workspace users are recruiter. Older talent_user values should not be used for new job seeker records.';
