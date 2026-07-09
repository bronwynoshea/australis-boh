-- Tenant-scoped public SLOTZ booking resolver.
-- Lets anonymous booking pages resolve a staff profile by tenant slug + staff slug
-- without granting direct public reads on boh_tenant.

create or replace function public.slotz_resolve_public_staff(
  p_tenant_slug text,
  p_staff_slug text
)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  slug text,
  timezone text,
  meeting_link text,
  tenant_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.id,
    sp.user_id,
    sp.full_name,
    sp.email,
    sp.slug,
    sp.timezone,
    sp.meeting_link,
    sp.tenant_id
  from public.scheduling_staff_profiles sp
  join public.boh_tenant bt on bt.id = sp.tenant_id
  where bt.slug = p_tenant_slug
    and sp.slug = p_staff_slug
  limit 1;
$$;

grant execute on function public.slotz_resolve_public_staff(text, text) to anon, authenticated;
