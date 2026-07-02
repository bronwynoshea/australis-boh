begin;

create unique index if not exists loft_video_session_slotz_booking_uidx
  on public.loft_video_session(tenant_id, business_record_table, business_record_id)
  where source_app = 'slotz'
    and business_record_table = 'scheduling_bookings'
    and business_record_id is not null;

commit;
