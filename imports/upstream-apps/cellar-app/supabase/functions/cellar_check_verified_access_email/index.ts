import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarServiceClient } from '../_shared/cellar_supabase.ts';

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.cellar_email);
    if (!email || !email.includes('@')) return cellarError('CELLAR_EMAIL_REQUIRED', 400);

    const client = cellarServiceClient();

    const { data: staffUser, error: staffError } = await client
      .from('boh_user')
      .select('id, auth_user_id, status')
      .ilike('email', email)
      .maybeSingle();
    if (staffError) return cellarError(staffError.message, 400);

    if (staffUser?.auth_user_id && staffUser.status !== 'inactive') {
      return cellarJson({
        cellar_can_send_code: true,
        cellar_access_mode: 'staff',
      });
    }

    const { data: investorAccess, error: investorError } = await client
      .from('cellar_investor_access')
      .select('id, auth_user_id, access_status')
      .ilike('email', email)
      .maybeSingle();
    if (investorError) return cellarError(investorError.message, 400);

    const { data: investorProfile, error: profileError } = await client
      .from('cellar_investor_profiles')
      .select('id, auth_user_id, investor_access_id, profile_status')
      .ilike('email', email)
      .maybeSingle();
    if (profileError) return cellarError(profileError.message, 400);

    const approvedStatuses = ['verified', 'appendix_requested', 'appendix_granted'];
    if (investorAccess?.id && approvedStatuses.includes(investorAccess.access_status)) {
      return cellarJson({
        cellar_can_send_code: true,
        cellar_access_mode: 'investor',
      });
    }

    if (investorProfile?.profile_status === 'verified') {
      return cellarJson({
        cellar_can_send_code: true,
        cellar_access_mode: 'investor_profile_verified',
      });
    }

    return cellarJson({
      cellar_can_send_code: false,
      cellar_access_mode: investorAccess?.id || investorProfile?.id ? 'investor_not_ready' : 'not_found',
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_CHECK_VERIFIED_ACCESS_EMAIL_FAILED',
      500,
    );
  }
});
