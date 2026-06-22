-- CELLAR storage policy placeholder.
-- BOH-DEV manual SQL may not own storage.objects, so direct storage policies
-- are intentionally deferred until deployment can run with the right owner.
-- Until then, the private bucket remains non-public and investor/guest reads
-- must be mediated through signed URL logic after CELLAR access checks.
do $$
begin
  raise notice 'CELLAR storage policies deferred; bucket remains private.';
end $$;
