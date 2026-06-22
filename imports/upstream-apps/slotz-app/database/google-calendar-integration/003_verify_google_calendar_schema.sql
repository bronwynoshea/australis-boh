select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'google_oauth_tokens',
    'google_calendar_sync',
    'outlook_synced_events'
  )
order by table_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'outlook_synced_events'
  and column_name in (
    'calendar_provider',
    'external_event_id',
    'external_calendar_id'
  )
order by column_name;
