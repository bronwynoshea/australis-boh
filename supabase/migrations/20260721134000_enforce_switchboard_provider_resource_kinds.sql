begin;

create or replace function private.boh_switchboard_validate_resource_provider_kind()
returns trigger
language plpgsql
set search_path=public,private,pg_temp
as $$
declare
  selected_provider text;
begin
  select connection.provider
  into selected_provider
  from public.boh_switchboard_connections connection
  where connection.tenant_id=new.tenant_id
    and connection.id=new.connection_id;

  if selected_provider is null then
    raise exception 'Switchboard resource connection is required' using errcode='23503';
  end if;

  if not (
    (selected_provider='github' and new.resource_kind in ('repository','workflow'))
    or (selected_provider='cloudflare' and new.resource_kind in ('pages_project','worker','domain'))
    or (selected_provider='supabase' and new.resource_kind='supabase_project')
    or (selected_provider='vercel' and new.resource_kind in ('other','domain'))
    or (selected_provider='other' and new.resource_kind in ('other','domain'))
  ) then
    raise exception 'Resource type is not valid for the selected provider' using errcode='22023';
  end if;

  return new;
end;
$$;

revoke all on function private.boh_switchboard_validate_resource_provider_kind() from public,anon,authenticated,service_role;

drop trigger if exists boh_switchboard_resources_provider_kind_guard on public.boh_switchboard_resources;
create trigger boh_switchboard_resources_provider_kind_guard
before insert or update of tenant_id,connection_id,resource_kind
on public.boh_switchboard_resources
for each row execute function private.boh_switchboard_validate_resource_provider_kind();

commit;
