alter table public.outlook_synced_events
  add column if not exists calendar_provider text not null default 'outlook',
  add column if not exists external_event_id text,
  add column if not exists external_calendar_id text;

update public.outlook_synced_events
set
  calendar_provider = coalesce(calendar_provider, 'outlook'),
  external_event_id = coalesce(external_event_id, outlook_event_id)
where external_event_id is null
   or calendar_provider is null;

create index if not exists outlook_synced_events_provider_staff_start_idx
  on public.outlook_synced_events(calendar_provider, staff_id, event_start_time);
