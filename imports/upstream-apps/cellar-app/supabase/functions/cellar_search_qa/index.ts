import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json();
    const query = String(body.cellar_query ?? '');
    if (!query.trim()) return cellarJson({ cellar_results: [] });

    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);
    const sessionId = body.cellar_session_id ?? null;
    const limit = Math.min(Math.max(Number(body.cellar_limit ?? 10), 1), 25);
    let accessStatus: string | null = null;
    if (user) {
      const { data } = await client.from('cellar_investor_access')
        .select('access_status')
        .eq('auth_user_id', user.id)
        .in('access_status', ['verified', 'appendix_requested', 'appendix_granted'])
        .order('verified_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      accessStatus = data?.access_status ?? null;
    }
    let hasGuestSession = false;
    if (sessionId) {
      const { data } = await client.from('cellar_investor_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('session_kind', 'guest_code')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .maybeSingle();
      hasGuestSession = Boolean(data);
    }
    if (!accessStatus && !hasGuestSession) return cellarJson({ cellar_results: [] });
    const visibility = accessStatus === 'appendix_granted'
      ? ['guest', 'verified', 'appendix_granted']
      : accessStatus ? ['guest', 'verified'] : ['guest'];
    const { data, error } = await client.from('cellar_prepared_qa')
      .select('id, question, answer, topic, related_asset_id')
      .eq('status', 'published')
      .eq('investor_kb_scope', 'investor_kb')
      .in('visibility', visibility)
      .textSearch('question', query, { type: 'plain' })
      .limit(limit);
    if (error) return cellarError(error.message, 400);
    return cellarJson({ cellar_results: data ?? [] });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_SEARCH_QA_FAILED', 500);
  }
});
