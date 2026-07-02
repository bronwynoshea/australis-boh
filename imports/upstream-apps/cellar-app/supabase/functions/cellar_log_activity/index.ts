import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json();
    const investorId = String(body.cellar_investor_access_id ?? '');
    const eventType = String(body.cellar_event_type ?? '');
    if (!investorId || !eventType) return cellarError('CELLAR_ACTIVITY_FIELDS_REQUIRED', 400);

    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);
    if (!user) return cellarError('CELLAR_AUTH_REQUIRED', 401);
    const { data: access } = await client.from('cellar_investor_access')
      .select('id, auth_user_id')
      .eq('id', investorId)
      .maybeSingle();
    if (access?.auth_user_id !== user.id) return cellarError('CELLAR_ACTIVITY_ACCESS_DENIED', 403);

    const { data, error } = await client.from('cellar_activity_events').insert({
      investor_access_id: investorId,
      actor_kind: 'verified_investor',
      actor_auth_user_id: user.id,
      event_type: eventType,
      metadata: body.cellar_metadata ?? {},
    }).select('id').single();
    if (error) return cellarError(error.message, 400);
    return cellarJson({ cellar_activity_event_id: data.id });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_ACTIVITY_LOG_FAILED', 500);
  }
});
