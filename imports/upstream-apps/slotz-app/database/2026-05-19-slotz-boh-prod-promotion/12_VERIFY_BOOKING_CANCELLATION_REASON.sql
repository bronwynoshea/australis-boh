select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scheduling_bookings'
  and column_name = 'cancellation_reason';
