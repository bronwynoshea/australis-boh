-- Ensure Slotz reminder jobs inherit the booking tenant_id.
-- No fallback/default tenant: reminder rows must carry the booking tenant explicitly.

create or replace function public.enqueue_booking_reminder_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' then
    if new.tenant_id is null then
      raise exception 'booking_tenant_id_required';
    end if;

    insert into public.scheduling_reminder_jobs (tenant_id, booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.tenant_id, new.id, 'booking_confirmed', 'guest', now()),
      (new.tenant_id, new.id, 'booking_confirmed', 'staff', now()),
      (new.tenant_id, new.id, 'reminder_24h', 'guest', new.start_time - interval '24 hours'),
      (new.tenant_id, new.id, 'reminder_24h', 'staff', new.start_time - interval '24 hours'),
      (new.tenant_id, new.id, 'reminder_1h', 'guest', new.start_time - interval '1 hour'),
      (new.tenant_id, new.id, 'reminder_1h', 'staff', new.start_time - interval '1 hour');
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_booking_change_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    raise exception 'booking_tenant_id_required';
  end if;

  if old.status = 'confirmed' and new.status = 'cancelled' then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id and status = 'pending';

    insert into public.scheduling_reminder_jobs (tenant_id, booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.tenant_id, new.id, 'event_canceled', 'guest', now()),
      (new.tenant_id, new.id, 'event_canceled', 'staff', now());
  elsif new.status = 'confirmed'
    and (old.start_time <> new.start_time or old.end_time <> new.end_time)
  then
    update public.scheduling_reminder_jobs
      set status = 'canceled', updated_at = now()
      where booking_id = new.id
        and status = 'pending'
        and job_type in ('reminder_24h', 'reminder_1h');

    insert into public.scheduling_reminder_jobs (tenant_id, booking_id, job_type, recipient_type, scheduled_for)
    values
      (new.tenant_id, new.id, 'event_rescheduled', 'guest', now()),
      (new.tenant_id, new.id, 'event_rescheduled', 'staff', now()),
      (new.tenant_id, new.id, 'reminder_24h', 'guest', new.start_time - interval '24 hours'),
      (new.tenant_id, new.id, 'reminder_24h', 'staff', new.start_time - interval '24 hours'),
      (new.tenant_id, new.id, 'reminder_1h', 'guest', new.start_time - interval '1 hour'),
      (new.tenant_id, new.id, 'reminder_1h', 'staff', new.start_time - interval '1 hour');
  end if;

  return new;
end;
$$;
