import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const bucketName = 'cellar_investor_assets';
const allowedTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
]);
const allowedAssetTypes = new Set(['deck', 'document', 'video']);
const allowedVisibility = new Set(['guest', 'verified', 'appendix_granted', 'staff_only']);
const allowedStatus = new Set(['draft', 'published']);

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const form = await request.formData();
    const file = form.get('cellar_file');
    if (!(file instanceof File)) return cellarError('CELLAR_FILE_REQUIRED', 400);
    if (!allowedTypes.has(file.type)) return cellarError('CELLAR_FILE_TYPE_NOT_ALLOWED', 400);

    const title = String(form.get('cellar_title') ?? '').trim();
    const assetType = String(form.get('cellar_asset_type') ?? '').trim();
    const visibility = String(form.get('cellar_visibility') ?? '').trim();
    const status = String(form.get('cellar_status') ?? '').trim();
    const tabLabel = String(form.get('cellar_tab_label') ?? '').trim();
    const summary = String(form.get('cellar_summary') ?? '').trim();
    const presentationId = String(form.get('cellar_presentation_id') ?? '').trim();
    if (!title) return cellarError('CELLAR_TITLE_REQUIRED', 400);
    if (!tabLabel) return cellarError('CELLAR_TAB_LABEL_REQUIRED', 400);
    if (!presentationId) return cellarError('CELLAR_PRESENTATION_REQUIRED', 400);
    if (!allowedAssetTypes.has(assetType)) return cellarError('CELLAR_ASSET_TYPE_REQUIRED', 400);
    if (!allowedVisibility.has(visibility)) return cellarError('CELLAR_VISIBILITY_REQUIRED', 400);
    if (!allowedStatus.has(status)) return cellarError('CELLAR_STATUS_REQUIRED', 400);

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!safeName) return cellarError('CELLAR_FILE_NAME_REQUIRED', 400);
    const storagePath = `staff/${staffUser.bohUserId}/${crypto.randomUUID()}-${safeName}`;
    const client = cellarServiceClient();
    const { data: presentation, error: presentationError } = await client
      .from('cellar_presentations')
      .select('id')
      .eq('id', presentationId)
      .eq('tenant_id', staffUser.tenantId)
      .neq('status', 'archived')
      .single();
    if (presentationError || !presentation) return cellarError('CELLAR_PRESENTATION_NOT_FOUND', 404);
    const { data: lastAsset } = await client
      .from('cellar_assets')
      .select('sort_order')
      .eq('presentation_id', presentationId)
      .eq('tenant_id', staffUser.tenantId)
      .neq('status', 'archived')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (lastAsset?.sort_order ?? 0) + 10;

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return cellarError(uploadError.message, 400);

    const { data, error } = await client.from('cellar_assets').insert({
      tenant_id: staffUser.tenantId,
      presentation_id: presentationId,
      title,
      asset_type: assetType,
      visibility,
      status,
      tab_label: tabLabel,
      summary,
      storage_bucket: bucketName,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      sort_order: nextSortOrder,
      created_by_boh_user_id: staffUser.bohUserId,
      updated_by_boh_user_id: staffUser.bohUserId,
      published_at: status === 'published' ? new Date().toISOString() : null,
    }).select('id, presentation_id, title, asset_type, visibility, status, tab_label, storage_path').single();
    if (error) return cellarError(error.message, 400);

    return cellarJson({ cellar_asset: data }, 201);
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_UPLOAD_ASSET_FAILED', 500);
  }
});
