import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const reviewActions = new Set(['approve', 'need_more_info', 'decline']);

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const body = await request.json().catch(() => ({}));
    const investorProfileId = String(body.cellar_investor_profile_id ?? '').trim();
    const reviewAction = String(body.cellar_review_action ?? '').trim().toLowerCase();

    if (!investorProfileId) return cellarError('CELLAR_INVESTOR_PROFILE_REQUIRED', 400);
    if (!reviewActions.has(reviewAction)) return cellarError('CELLAR_REVIEW_ACTION_INVALID', 400);

    const client = cellarServiceClient();
    const { data, error } = await client.rpc('cellar_review_investor_request', {
      p_investor_profile_id: investorProfileId,
      p_action: reviewAction,
      p_boh_user_id: staffUser.bohUserId,
      p_metadata: {
        source: 'cellar_review_investor_request',
        requested_by_boh_user_id: staffUser.bohUserId,
      },
    });

    if (error) return cellarError(error.message, 400);

    const review = data?.[0] ?? null;
    if (reviewAction === 'approve' && review?.investor_access_id) {
      const { error: assignError } = await client
        .from('cellar_investor_access')
        .update({
          assigned_boh_user_id: staffUser.bohUserId,
          updated_by_boh_user_id: staffUser.bohUserId,
        })
        .eq('id', review.investor_access_id);
      if (assignError) return cellarError(assignError.message, 400);
    }

    return cellarJson({
      cellar_review: review,
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_REVIEW_INVESTOR_REQUEST_FAILED',
      500,
    );
  }
});
