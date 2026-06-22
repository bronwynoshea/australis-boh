import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const CELLAR_APPROVED_ACCESS_STATUSES = ['verified', 'appendix_requested', 'appendix_granted'];

function cleanText(value: unknown, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const user = await cellarAuthenticatedUser(request);
    if (!user?.id) return cellarError('CELLAR_AUTH_REQUIRED', 401);

    const body = await request.json().catch(() => ({}));
    const firstName = cleanText(body.cellar_first_name, 80);
    const lastName = cleanText(body.cellar_last_name, 80);
    const title = cleanText(body.cellar_title, 120);
    const company = cleanText(body.cellar_company, 160);
    const phone = cleanText(body.cellar_phone, 60);

    if (!firstName || !lastName) return cellarError('CELLAR_PROFILE_NAME_REQUIRED', 400);

    const client = cellarServiceClient();
    const { data: firstInvestorAccess, error: accessError } = await client
      .from('cellar_investor_access')
      .select('id, email, full_name, access_status, auth_user_id')
      .eq('auth_user_id', user.id)
      .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
      .maybeSingle();

    if (accessError) return cellarError(accessError.message, 400);
    let investorAccess = firstInvestorAccess;

    if (!investorAccess?.id && user.email) {
      const byEmail = await client
        .from('cellar_investor_access')
        .select('id, email, full_name, access_status, auth_user_id')
        .ilike('email', String(user.email).trim().toLowerCase())
        .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
        .maybeSingle();
      if (byEmail.error) return cellarError(byEmail.error.message, 400);
      investorAccess = byEmail.data;

      if (investorAccess?.id && investorAccess.auth_user_id !== user.id) {
        await client
          .from('cellar_investor_access')
          .update({ auth_user_id: user.id })
          .eq('id', investorAccess.id);
      }
    }

    if (!investorAccess?.id) return cellarError('CELLAR_INVESTOR_ACCESS_REQUIRED', 403);

    const { data: existingProfile, error: profileError } = await client
      .from('cellar_investor_profiles')
      .select('id, metadata')
      .eq('investor_access_id', investorAccess.id)
      .maybeSingle();

    if (profileError) return cellarError(profileError.message, 400);
    if (!existingProfile?.id) return cellarError('CELLAR_INVESTOR_PROFILE_NOT_FOUND', 404);

    const nextMetadata = {
      ...((existingProfile.metadata && typeof existingProfile.metadata === 'object') ? existingProfile.metadata : {}),
      phone,
    };

    const { error: updateProfileError } = await client
      .from('cellar_investor_profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        title: title || null,
        company: company || null,
        metadata: nextMetadata,
      })
      .eq('id', existingProfile.id);

    if (updateProfileError) return cellarError(updateProfileError.message, 400);

    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const { error: updateAccessError } = await client
      .from('cellar_investor_access')
      .update({ full_name: fullName })
      .eq('id', investorAccess.id);

    if (updateAccessError) return cellarError(updateAccessError.message, 400);

    return cellarJson({
      cellar_profile_updated: true,
      cellar_investor_access_id: investorAccess.id,
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_UPDATE_INVESTOR_PROFILE_FAILED',
      500,
    );
  }
});
