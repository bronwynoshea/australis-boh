import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const allowedInvestorCategories = new Set([
  'individual',
  'angel',
  'fund',
  'family_office',
  'strategic',
  'advisor',
  'other',
]);

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const user = await cellarAuthenticatedUser(request);
    if (!user?.id || !user.email) return cellarError('CELLAR_AUTH_REQUIRED', 401);

    const body = await request.json();
    const cellarEmail = String(body.cellar_email ?? '').trim().toLowerCase();
    const cellarFirstName = String(body.cellar_first_name ?? '').trim();
    const cellarLastName = String(body.cellar_last_name ?? '').trim();
    const cellarInvestorCategory = String(body.cellar_investor_category ?? '').trim().toLowerCase();
    const cellarTitle = String(body.cellar_title ?? '').trim();
    const cellarCompany = String(body.cellar_company ?? '').trim();

    if (!cellarEmail || cellarEmail !== user.email.toLowerCase()) {
      return cellarError('CELLAR_EMAIL_MUST_MATCH_AUTH_USER', 400);
    }
    if (!cellarFirstName) return cellarError('CELLAR_INVESTOR_FIRST_NAME_REQUIRED', 400);
    if (!cellarLastName) return cellarError('CELLAR_INVESTOR_LAST_NAME_REQUIRED', 400);
    if (!allowedInvestorCategories.has(cellarInvestorCategory)) {
      return cellarError('CELLAR_INVESTOR_CATEGORY_REQUIRED', 400);
    }

    const client = cellarServiceClient();
    const { data, error } = await client.rpc('cellar_submit_investor_profile', {
      p_auth_user_id: user.id,
      p_email: cellarEmail,
      p_first_name: cellarFirstName,
      p_last_name: cellarLastName,
      p_investor_category: cellarInvestorCategory,
      p_title: cellarTitle || null,
      p_company: cellarCompany || null,
      p_metadata: {
        user_agent: request.headers.get('user-agent'),
        submitted_via: 'cellar_verified_access_drawer',
      },
    });

    if (error) return cellarError(error.message, 400);

    const profile = data?.[0] ?? null;
    if (profile?.is_staff_email) {
      return cellarJson({
        cellar_staff_email: true,
        message: 'CELLAR_STAFF_EMAIL_SKIPPED',
      });
    }

    return cellarJson({
      cellar_profile_request: profile,
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_INVESTOR_PROFILE_SUBMIT_FAILED',
      500,
    );
  }
});
