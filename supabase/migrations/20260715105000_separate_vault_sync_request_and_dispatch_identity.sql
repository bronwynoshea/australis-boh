-- Separate the service that queues a Vault synchronization run from the service
-- that dispatches and completes it. Both identities remain auditable and immutable.
begin;

alter table public.boh_vault_sync_runs
  add column if not exists dispatch_service_identity text;

-- created_at is server-assigned and immutable. The former transaction-relative
-- check was reevaluated on UPDATE and made valid queued runs impossible to start
-- after five seconds.
alter table public.boh_vault_sync_runs
  drop constraint boh_vault_sync_runs_timestamp_guard;
alter table public.boh_vault_sync_runs
  add constraint boh_vault_sync_runs_timestamp_guard check (
    started_at is null or started_at >= created_at
  );

alter table public.boh_vault_sync_runs
  add constraint boh_vault_sync_runs_dispatch_identity_guard check (
    (status = 'queued' and dispatch_service_identity is null)
    or (status = 'running' and btrim(coalesce(dispatch_service_identity, '')) <> '')
    or (status in ('succeeded','failed') and btrim(coalesce(dispatch_service_identity, '')) <> '')
    or (status = 'cancelled' and (
      (started_at is null and dispatch_service_identity is null)
      or (started_at is not null and btrim(coalesce(dispatch_service_identity, '')) <> '')
    ))
  );

create or replace function public.boh_vault_guard_sync_run_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vault sync runs cannot be deleted' using errcode = '55000';
  end if;
  if (new.tenant_id,new.binding_id,new.vault_item_id,new.item_field_id,new.secret_version_id,new.environment,
      new.attempt,new.request_id,new.service_identity,new.requested_by,new.created_at)
     is distinct from
     (old.tenant_id,old.binding_id,old.vault_item_id,old.item_field_id,old.secret_version_id,old.environment,
      old.attempt,old.request_id,old.service_identity,old.requested_by,old.created_at) then
    raise exception 'Vault sync run identity is immutable' using errcode = '55000';
  end if;
  if old.status = 'queued' and new.status = 'running' then
    if old.started_at is not null or new.started_at is null or new.completed_at is not null or new.result_code is not null
       or btrim(coalesce(new.dispatch_service_identity,'')) = '' then
      raise exception 'Starting a run requires its dispatcher identity, status, and started_at' using errcode = '55000';
    end if;
  elsif old.status = 'queued' and new.status = 'cancelled' then
    if new.started_at is not null or new.completed_at is null or btrim(coalesce(new.result_code,'')) = ''
       or new.dispatch_service_identity is not null then
      raise exception 'Cancelling a queued run permits only terminal cancellation fields' using errcode = '55000';
    end if;
  elsif old.status = 'running' and new.status in ('succeeded','failed','cancelled') then
    if new.started_at is distinct from old.started_at or new.completed_at is null
       or btrim(coalesce(new.result_code,'')) = ''
       or new.dispatch_service_identity is distinct from old.dispatch_service_identity then
      raise exception 'Completing a running run permits only terminal result fields' using errcode = '55000';
    end if;
  elsif new is distinct from old then
    if new.status = old.status then
      raise exception 'Sync lifecycle timestamps and results are immutable outside an exact transition' using errcode = '55000';
    end if;
    raise exception 'Invalid sync run transition: % -> %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.boh_vault_start_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_actor_boh_user_id uuid,
  requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype;
begin
  select * into run_row from public.boh_vault_sync_runs
  where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if run_row.status <> 'queued' then raise exception 'Only queued runs can start' using errcode = '22023'; end if;
  update public.boh_vault_sync_runs
  set status='running', started_at=transaction_timestamp(), dispatch_service_identity=requested_service_identity
  where tenant_id=requested_tenant_id and id=requested_run_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_started',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id,'request_service_identity',run_row.service_identity));
end;
$$;

create or replace function public.boh_vault_complete_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_result_code text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype; completed_time timestamptz := transaction_timestamp();
begin
  select * into run_row from public.boh_vault_sync_runs
  where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode = '23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity is distinct from run_row.dispatch_service_identity then
    raise exception 'Run dispatcher identity mismatch' using errcode='42501';
  end if;
  if run_row.status <> 'running' or btrim(coalesce(requested_result_code,'')) = '' then
    raise exception 'Only running runs can complete with a result code' using errcode='22023';
  end if;
  update public.boh_vault_sync_runs set status='succeeded',completed_at=completed_time,result_code=requested_result_code
  where tenant_id=requested_tenant_id and id=requested_run_id;
  update public.boh_vault_sync_bindings set state='ready',last_synced_secret_version_id=run_row.secret_version_id,
    last_synced_at=completed_time,updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=run_row.binding_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_completed',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id,'result_code',requested_result_code));
end;
$$;

create or replace function public.boh_vault_fail_sync_run(
  requested_tenant_id uuid, requested_run_id uuid, requested_result_code text,
  requested_actor_boh_user_id uuid, requested_service_identity text, requested_request_id text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare run_row public.boh_vault_sync_runs%rowtype;
begin
  select * into run_row from public.boh_vault_sync_runs where tenant_id=requested_tenant_id and id=requested_run_id for update;
  if not found then raise exception 'Sync run not found' using errcode='23503'; end if;
  perform public.boh_vault_assert_sync_actor(requested_tenant_id,requested_actor_boh_user_id,
    run_row.environment,array['vault_admin','sync_operator']::text[],requested_service_identity);
  if requested_service_identity is distinct from run_row.dispatch_service_identity then
    raise exception 'Run dispatcher identity mismatch' using errcode='42501';
  end if;
  if run_row.status <> 'running' or btrim(coalesce(requested_result_code,'')) = '' then
    raise exception 'Only running runs can fail with a result code' using errcode='22023';
  end if;
  update public.boh_vault_sync_runs set status='failed',completed_at=transaction_timestamp(),result_code=requested_result_code
  where tenant_id=requested_tenant_id and id=requested_run_id;
  update public.boh_vault_sync_bindings set state='error',updated_by=requested_actor_boh_user_id
  where tenant_id=requested_tenant_id and id=run_row.binding_id;
  perform public.boh_vault_append_audit_event(requested_tenant_id,run_row.vault_item_id,requested_actor_boh_user_id,
    requested_service_identity,'sync_failed',requested_request_id,run_row.environment,
    'sync_run',requested_run_id,jsonb_build_object('binding_id',run_row.binding_id,'field_id',run_row.item_field_id,
      'version_id',run_row.secret_version_id,'result_code',requested_result_code));
end;
$$;

comment on column public.boh_vault_sync_runs.dispatch_service_identity is
  'Immutable service identity that claimed and dispatched the queued run; distinct from the requesting service identity.';

commit;
