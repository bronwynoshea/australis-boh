-- BOH-dev Loft permission normalization
-- Personal Rooms remain automatic for recruiter/coach/staff external profiles.
-- Clubhouse-style Loft hosting remains request/review based for everyone except staff/admin.

update public.profile p
set can_host_loft = false
from public.loft_external_profile_link l
where l.profile_id = p.id
  and l.persona in ('recruiter', 'coach')
  and coalesce(p.can_host_loft, false) = true
  and not exists (
    select 1
    from public.host_application h
    where h.profile_id = p.id
      and h.status = 'approved'
      and h.requested_host_scope = 'user_generated'
  );
