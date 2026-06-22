import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json();
    const bookingUrl = String(body.cellar_booking_url ?? '');
    if (!bookingUrl) return cellarError('CELLAR_BOOKING_URL_REQUIRED', 400);

    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);
    if (!user) return cellarError('CELLAR_AUTH_REQUIRED', 401);
    const investorId = String(body.cellar_investor_access_id ?? '');
    const { data: access } = await client.from('cellar_investor_access')
      .select('id, auth_user_id')
      .eq('id', investorId)
      .maybeSingle();
    if (access?.auth_user_id !== user.id) return cellarError('CELLAR_BOOKING_LINK_ACCESS_DENIED', 403);
    const { data, error } = await client.from('cellar_booking_link_audits').insert({
      investor_access_id: investorId,
      booking_url: bookingUrl,
      metadata: body.cellar_metadata ?? {},
    }).select('id').single();
    if (error) return cellarError(error.message, 400);
    return cellarJson({ cellar_booking_link_audit_id: data.id });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_BOOKING_LINK_AUDIT_FAILED', 500);
  }
});
