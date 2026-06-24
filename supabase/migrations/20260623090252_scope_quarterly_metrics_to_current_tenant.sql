-- Scope quarterly product metrics to the authenticated BOH tenant.

create or replace function public.get_quarterly_metrics(p_quarter text, p_year integer)
returns table(
  total_initiatives bigint,
  active_initiatives bigint,
  completed_initiatives bigint,
  total_releases bigint,
  major_releases bigint,
  minor_releases bigint,
  total_tickets bigint,
  internal_tickets bigint,
  external_tickets bigint,
  average_initiative_progress numeric,
  releases_per_initiative numeric
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tenant_id uuid := public.current_boh_tenant_id();
begin
  if v_tenant_id is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::numeric, 0::numeric;
    return;
  end if;

  return query
  with
  initiative_metrics as (
    select
      count(*) as total,
      count(*) filter (where status in ('planned', 'in progress')) as active,
      count(*) filter (where status = 'done') as completed,
      avg(progress) as avg_progress
    from public.boh_initiative
    where tenant_id = v_tenant_id
      and target_quarter = p_quarter
      and target_year = p_year
      and is_archived = false
  ),
  release_metrics as (
    select
      count(*) as total,
      count(*) filter (where release_tier = 'major') as major,
      count(*) filter (where release_tier = 'minor') as minor
    from public.boh_release_version
    where tenant_id = v_tenant_id
      and quarter = p_quarter
      and year = p_year
  ),
  ticket_metrics as (
    select
      count(*) as total,
      count(*) filter (where ct.app_context = 'boh') as internal,
      count(*) filter (where ct.app_context != 'boh') as external
    from public.counter_ticket ct
    where ct.tenant_id = v_tenant_id
      and ct.created_at >= make_date(p_year::integer, (substring(p_quarter, 2, 1)::integer - 1) * 3 + 1, 1)
      and ct.created_at < make_date(p_year::integer, (substring(p_quarter, 2, 1)::integer) * 3 + 1, 1)
  )
  select
    im.total,
    im.active,
    im.completed,
    rm.total,
    rm.major,
    rm.minor,
    tm.total,
    tm.internal,
    tm.external,
    coalesce(im.avg_progress, 0),
    case
      when im.total > 0 then round(rm.total::numeric / im.total::numeric, 2)
      else 0
    end
  from initiative_metrics im, release_metrics rm, ticket_metrics tm;
end;
$function$;

grant execute on function public.get_quarterly_metrics(text, integer) to authenticated;
