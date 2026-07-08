-- Align live SLOTZ booking routing columns with BOH-dev.
-- Safe/idempotent production promotion for SLOTZ shared calendar routing.

begin;

alter table public.scheduling_bookings
  add column if not exists booking_account_staff_id uuid,
  add column if not exists routed_calendar_owner_staff_id uuid,
  add column if not exists routed_calendar_owner_email text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduling_bookings_booking_account_staff_id_fkey'
      and conrelid = 'public.scheduling_bookings'::regclass
  ) then
    alter table public.scheduling_bookings
      add constraint scheduling_bookings_booking_account_staff_id_fkey
      foreign key (booking_account_staff_id)
      references public.scheduling_staff_profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduling_bookings_routed_calendar_owner_staff_id_fkey'
      and conrelid = 'public.scheduling_bookings'::regclass
  ) then
    alter table public.scheduling_bookings
      add constraint scheduling_bookings_routed_calendar_owner_staff_id_fkey
      foreign key (routed_calendar_owner_staff_id)
      references public.scheduling_staff_profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_scheduling_blackout_dates_staff_id_fk
  on public.scheduling_blackout_dates(staff_id);

create index if not exists idx_scheduling_bookings_booking_account_staff_id_fk
  on public.scheduling_bookings(booking_account_staff_id);

create index if not exists idx_scheduling_bookings_meeting_type_id_fk
  on public.scheduling_bookings(meeting_type_id);

create index if not exists idx_scheduling_bookings_staff_id_fk
  on public.scheduling_bookings(staff_id);

create index if not exists scheduling_bookings_routed_owner_idx
  on public.scheduling_bookings(routed_calendar_owner_staff_id, start_time);

commit;
