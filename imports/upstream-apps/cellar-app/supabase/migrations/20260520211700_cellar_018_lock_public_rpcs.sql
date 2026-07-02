-- CELLAR production-style RPC lockdown: Edge Functions are the callable boundary.
revoke execute on function public.cellar_current_boh_user_id() from public, anon, authenticated;
revoke execute on function public.cellar_is_verified_investor(uuid) from public, anon, authenticated;
revoke execute on function public.cellar_current_investor_access_status() from public, anon, authenticated;
revoke execute on function public.cellar_has_verified_investor_access() from public, anon, authenticated;
revoke execute on function public.cellar_staff_can_access_investor(uuid) from public, anon, authenticated;

revoke execute on function public.cellar_verify_guest_access_code(text, text, text) from public, anon, authenticated;
grant execute on function public.cellar_verify_guest_access_code(text, text, text) to service_role;

revoke execute on function public.cellar_log_activity(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.cellar_search_prepared_qa(text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.cellar_create_investor_question(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.cellar_create_message(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.cellar_create_booking_link_audit(uuid, text, jsonb) from public, anon, authenticated;

comment on function public.cellar_verify_guest_access_code(text, text, text) is
  'CELLAR service-role RPC used by cellar_verify_access_code Edge Function only.';
