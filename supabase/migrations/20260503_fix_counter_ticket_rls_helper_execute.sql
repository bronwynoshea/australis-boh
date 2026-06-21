-- Restore Counter ticket visibility under RLS for authenticated BOH users.
--
-- The current Counter ticket policies in BOH dev call public.is_boh_user(...).
-- A later helper-hardening script revoked execute on that public helper, which
-- makes authenticated Counter reads fail with:
--   permission denied for function is_boh_user
--
-- This keeps anon blocked, but restores authenticated execution for the helper
-- signatures currently referenced by Counter ticket policies.

do $$
declare
  helper record;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_boh_user'
  loop
    execute format('revoke execute on function %s from anon', helper.signature);
    execute format('grant execute on function %s to authenticated', helper.signature);
  end loop;
end $$;
