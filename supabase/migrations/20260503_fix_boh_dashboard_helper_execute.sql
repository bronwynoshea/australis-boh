-- Restore BOH dashboard bootstrap reads under existing RLS policies.
--
-- Some legacy BOH policies still reference public helper functions directly.
-- Those helpers had EXECUTE revoked during helper hardening, which can make
-- authenticated PostgREST reads fail with 403 before newer bootstrap policies
-- can authorize the current BOH user.

do $$
declare
  helper record;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_boh_user_id',
        'is_boh_super_admin',
        'is_boh_user'
      )
  loop
    execute format('revoke execute on function %s from anon', helper.signature);
    execute format('grant execute on function %s to authenticated', helper.signature);
  end loop;
end $$;
