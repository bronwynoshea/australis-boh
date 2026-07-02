import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import {
  cellarAuthenticatedBohUser,
  cellarAuthenticatedUser,
  cellarServiceClient,
} from '../_shared/cellar_supabase.ts';

const cellarAssetSelect =
  'id, presentation_id, title, asset_type, visibility, status, tab_label, summary, slide_narratives, metadata, storage_bucket, storage_path, mime_type, sort_order';
const cellarAssetSelectWithoutNarratives =
  'id, presentation_id, title, asset_type, visibility, status, tab_label, summary, metadata, storage_bucket, storage_path, mime_type, sort_order';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body.cellar_session_id ?? '').trim();
    const staffWorkspace = Boolean(body.cellar_staff_workspace);
    const requestedPresentationId = String(body.cellar_presentation_id ?? '').trim();
    const client = cellarServiceClient();
    const staffUser = await cellarAuthenticatedBohUser(request);

    if (staffWorkspace) {
      if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

      const { data: presentations, error: presentationsError } = await client
        .from('cellar_presentations')
        .select('id, title, slug, description, status, sort_order, published_at')
        .eq('tenant_id', staffUser.tenantId)
        .neq('status', 'archived')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (presentationsError) return cellarError(presentationsError.message, 400);

      const createAssetsQuery = (selectColumns: string) => {
        const assetsQuery = client
          .from('cellar_assets')
          .select(selectColumns)
          .eq('tenant_id', staffUser.tenantId)
          .neq('status', 'archived')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(50);
        return requestedPresentationId
          ? assetsQuery.eq('presentation_id', requestedPresentationId)
          : assetsQuery.is('presentation_id', null);
      };
      let { data: assets, error: assetsError } = await createAssetsQuery(cellarAssetSelect);
      if (assetsError?.message?.includes('slide_narratives')) {
        const fallbackResult = await createAssetsQuery(cellarAssetSelectWithoutNarratives);
        assets = fallbackResult.data;
        assetsError = fallbackResult.error;
      }
      if (assetsError) return cellarError(assetsError.message, 400);

      return cellarJson({
        cellar_presentations: presentations ?? [],
        cellar_assets: assets ?? [],
      });
    }

    const authUser = staffUser ? null : await cellarAuthenticatedUser(request);
    const { data: investorAccess } = authUser
      ? await client
          .from('cellar_investor_access')
          .select('access_status, tenant_id')
          .eq('auth_user_id', authUser.id)
          .in('access_status', ['verified', 'appendix_requested', 'appendix_granted'])
          .maybeSingle()
      : { data: null };
    const { data: guestSession } = sessionId
      ? await client
          .from('cellar_investor_sessions')
          .select('id, tenant_id')
          .eq('id', sessionId)
          .eq('session_kind', 'guest_code')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
      : { data: null };

    if (!staffUser && !investorAccess && !guestSession) {
      return cellarJson({ cellar_assets: [] });
    }

    const allowedVisibility = staffUser
      ? ['guest', 'verified', 'appendix_granted']
      : investorAccess?.access_status === 'appendix_granted'
        ? ['guest', 'verified', 'appendix_granted']
        : investorAccess
          ? ['guest', 'verified']
          : ['guest'];

    const { data: presentations, error: presentationsError } = await client
      .from('cellar_presentations')
      .select('id, title, description, status, published_at')
      .eq('tenant_id', investorAccess?.tenant_id ?? guestSession?.tenant_id)
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false });
    if (presentationsError) return cellarError(presentationsError.message, 400);

    const presentationIds = (presentations ?? []).map((presentation) => presentation.id);

    if (presentationIds.length === 0) {
      return cellarJson({
        cellar_presentation: null,
        cellar_presentations: [],
        cellar_assets: [],
      });
    }
    const createPublishedAssetsQuery = (selectColumns: string) =>
      client
        .from('cellar_assets')
        .select(selectColumns)
        .eq('tenant_id', investorAccess?.tenant_id ?? guestSession?.tenant_id)
        .eq('status', 'published')
        .eq('investor_kb_scope', 'investor_kb')
        .in('visibility', allowedVisibility)
        .in('presentation_id', presentationIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
    let { data, error } = await createPublishedAssetsQuery(cellarAssetSelect);
    if (error?.message?.includes('slide_narratives')) {
      const fallbackResult = await createPublishedAssetsQuery(cellarAssetSelectWithoutNarratives);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) return cellarError(error.message, 400);
    return cellarJson({
      cellar_presentation: presentations?.[0] ?? null,
      cellar_presentations: presentations ?? [],
      cellar_assets: data ?? [],
    });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_LIST_ASSETS_FAILED', 500);
  }
});
