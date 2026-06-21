-- Add BOH app metadata to Counter tickets so tickets can be sorted and reported
-- by the canonical public.boh_app registry while keeping the legacy text app key.

alter table public.counter_ticket
  add column if not exists app_id uuid references public.boh_app(id),
  add column if not exists app_context text;

create index if not exists idx_counter_ticket_app_id
  on public.counter_ticket(app_id);

create index if not exists idx_counter_ticket_app_context
  on public.counter_ticket(app_context);

create index if not exists idx_counter_ticket_release_version_id
  on public.counter_ticket(release_version_id);

with matched_apps as (
  select
    ct.id as ticket_id,
    ba.id as app_id,
    ba.slug,
    ba.app_context
  from public.counter_ticket ct
  left join lateral (
    select app.id, app.slug, app.app_context
    from public.boh_app app
    where
      lower(app.slug) = lower(coalesce(ct.app, ''))
      or lower(app.name) = lower(coalesce(ct.app, ''))
      or lower(app.app_context) = lower(coalesce(ct.app, ''))
    order by app.sort_order nulls last, app.name
    limit 1
  ) ba on true
)
update public.counter_ticket ct
set
  app_id = coalesce(ct.app_id, matched_apps.app_id),
  app = coalesce(ct.app, matched_apps.slug),
  app_context = coalesce(ct.app_context, matched_apps.app_context, ct.app)
from matched_apps
where ct.id = matched_apps.ticket_id;

create or replace function public.set_counter_ticket_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_app public.boh_app%rowtype;
begin
  if new.app_id is not null then
    select *
    into resolved_app
    from public.boh_app
    where id = new.app_id
    limit 1;
  elsif nullif(trim(coalesce(new.app, '')), '') is not null then
    select *
    into resolved_app
    from public.boh_app
    where
      lower(slug) = lower(new.app)
      or lower(name) = lower(new.app)
      or lower(app_context) = lower(new.app)
    order by sort_order nulls last, name
    limit 1;
  elsif nullif(trim(coalesce(new.app_context, '')), '') is not null then
    select *
    into resolved_app
    from public.boh_app
    where lower(app_context) = lower(new.app_context)
    order by sort_order nulls last, name
    limit 1;
  end if;

  if resolved_app.id is not null then
    new.app_id := resolved_app.id;
    new.app := coalesce(resolved_app.slug, new.app);
    new.app_context := coalesce(resolved_app.app_context, resolved_app.slug, new.app_context, new.app);
  elsif new.app_context is null then
    new.app_context := new.app;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_counter_ticket_app_metadata on public.counter_ticket;

create trigger trg_counter_ticket_app_metadata
before insert or update of app_id, app, app_context
on public.counter_ticket
for each row
execute function public.set_counter_ticket_app_metadata();
