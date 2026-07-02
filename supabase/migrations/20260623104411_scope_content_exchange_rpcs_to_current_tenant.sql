-- Scope content exchange RPCs to the authenticated BOH user's current tenant.
-- Applied directly to BOH-DEV with `supabase db query --linked --file` because
-- this repo's older migration history currently makes `supabase db push --linked` unsafe.

create or replace function public.delete_content_exchange(p_exchange_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_project_id uuid;
  v_tenant_id uuid := public.current_boh_tenant_id();
  v_owner_auth uuid;
begin
  if auth.uid() is null or v_tenant_id is null then
    raise exception 'Not allowed';
  end if;

  select ce.project_id
    into v_project_id
  from public.content_exchanges ce
  where ce.id = p_exchange_id
    and ce.tenant_id = v_tenant_id;

  if v_project_id is null then
    raise exception 'Exchange not found';
  end if;

  select bu.auth_user_id
    into v_owner_auth
  from public.content_projects cp
  join public.boh_user bu
    on bu.id = cp.owner_user_id
   and bu.tenant_id = cp.tenant_id
  where cp.id = v_project_id
    and cp.tenant_id = v_tenant_id;

  if auth.uid() <> v_owner_auth then
    raise exception 'Not allowed';
  end if;

  delete from public.content_exchanges
  where id = p_exchange_id
    and project_id = v_project_id
    and tenant_id = v_tenant_id;
end;
$function$;

create or replace function public.reset_content_exchanges(p_project_id uuid, p_section_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.current_boh_tenant_id();
  v_owner_auth uuid;
begin
  if auth.uid() is null or v_tenant_id is null then
    raise exception 'Not allowed';
  end if;

  select bu.auth_user_id
    into v_owner_auth
  from public.content_projects cp
  join public.boh_user bu
    on bu.id = cp.owner_user_id
   and bu.tenant_id = cp.tenant_id
  where cp.id = p_project_id
    and cp.tenant_id = v_tenant_id;

  if v_owner_auth is null then
    raise exception 'Project not found';
  end if;

  if auth.uid() <> v_owner_auth then
    raise exception 'Not allowed';
  end if;

  if p_section_id is not null and not exists (
    select 1
    from public.content_sections cs
    where cs.id = p_section_id
      and cs.project_id = p_project_id
      and cs.tenant_id = v_tenant_id
  ) then
    raise exception 'Section not found';
  end if;

  delete from public.content_exchanges
  where project_id = p_project_id
    and tenant_id = v_tenant_id
    and (p_section_id is null or section_id = p_section_id);
end;
$function$;
