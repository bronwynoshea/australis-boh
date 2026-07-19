-- READ-ONLY BOH-DEV legacy Central cutover inventory.
-- Before running, independently verify supabase/.temp/project-ref is:
--   lczzeiqmnegyjrwtgmsj
-- This script reads catalog metadata only. It does not read protected values or data rows.

begin read only;

select
  n.nspname as schema_name,
  c.relname as object_name,
  case c.relkind
    when 'r' then 'table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'p' then 'partitioned_table'
    else c.relkind::text
  end as object_kind,
  c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'central\_%' escape '\'
order by c.relname;

select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name like 'central\_%' escape '\'
order by table_name, ordinal_position;

select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.constraint_schema = tc.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.constraint_schema = tc.constraint_schema
where tc.constraint_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and (tc.table_name like 'central\_%' escape '\' or ccu.table_name like 'central\_%' escape '\')
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename like 'central\_%' escape '\'
order by tablename, policyname;

rollback;
