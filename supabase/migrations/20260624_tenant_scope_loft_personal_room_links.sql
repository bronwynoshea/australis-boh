-- Tenant-scope Loft personal-room public links.
-- Public guest links must resolve by tenant slug + invite code, not invite code alone.

alter table public.loft_room
  add column if not exists tenant_id uuid references public.boh_tenant(id) on delete restrict;

-- Backfill existing personal rooms from the host profile's BOH user tenant.
update public.loft_room lr
set tenant_id = bu.tenant_id
from public.profile p
join public.boh_user bu on lower(bu.email) = lower(p.email)
where lr.host_profile_id = p.id
  and lr.tenant_id is null
  and bu.tenant_id is not null;

-- If any existing room could not be resolved through the host profile, default it
-- to the JOBZCAFE® tenant for backwards-seeded legacy Loft records.
update public.loft_room lr
set tenant_id = t.id
from public.boh_tenant t
where lr.tenant_id is null
  and t.slug = 'jobzcafe';

-- Invite codes should be unique within a tenant namespace. The old global unique
-- constraint is too restrictive for a shared multi-tenant model.
alter table public.loft_room
  drop constraint if exists loft_room_invite_code_key;

drop index if exists public.loft_room_invite_code_tenant_uidx;
create unique index loft_room_invite_code_tenant_uidx
  on public.loft_room (tenant_id, lower(invite_code))
  where invite_code is not null;

create index if not exists loft_room_tenant_id_idx
  on public.loft_room (tenant_id);
