-- BOH-DEV only. Archive weak slide-style Q&A created during early extraction testing.
update public.cellar_prepared_qa
set status = 'archived',
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('archived_reason', 'replaced_by_core_investor_qa_seed')
where status <> 'archived'
  and (
    question ilike 'What should investors know about%'
    or question ilike '% slide %'
  );
