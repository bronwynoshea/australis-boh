-- CELLAR BOH-DEV post-migration verification.
-- Run in BOH-DEV SQL editor only. Do not run against production BOH.

select 'cellar tables' as check_name, count(*) as found
from information_schema.tables
where table_schema = 'public'
  and table_name like 'cellar_%';

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename like 'cellar_%'
order by tablename;

select id, name, public
from storage.buckets
where id = 'cellar_investor_materials';

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name like 'cellar_%'
order by routine_name;

select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema = 'cellar_private'
order by routine_name;

select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
  and tablename like 'cellar_%'
order by tablename, policyname;

select policyname, tablename, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'cellar_%'
order by policyname;
