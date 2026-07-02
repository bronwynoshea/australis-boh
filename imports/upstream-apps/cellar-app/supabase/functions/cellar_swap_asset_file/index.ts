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

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const form = await request.formData();
    const assetId = String(form.get('cellar_asset_id') ?? '').trim();
    const file = form.get('cellar_file');
    if (!assetId) return cellarError('CELLAR_ASSET_REQUIRED', 400);
    if (!(file instanceof File)) return cellarError('CELLAR_FILE_REQUIRED', 400);
    if (!allowedTypes.has(file.type)) return cellarError('CELLAR_FILE_TYPE_NOT_ALLOWED', 400);

    const client = cellarServiceClient();
    const { data: asset, error: assetError } = await client
      .from('cellar_assets')
      .select('id, storage_bucket, storage_path')
      .eq('id', assetId)
      .neq('status', 'archived')
      .single();
    if (assetError || !asset) return cellarError('CELLAR_ASSET_NOT_FOUND', 404);

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!safeName) return cellarError('CELLAR_FILE_NAME_REQUIRED', 400);
    const storagePath = `staff/${staffUser.bohUserId}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return cellarError(uploadError.message, 400);

    const { data, error } = await client
      .from('cellar_assets')
      .update({
        storage_bucket: bucketName,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        updated_by_boh_user_id: staffUser.bohUserId,
      })
      .eq('id', assetId)
      .select('id, title, storage_bucket, storage_path, mime_type')
      .single();
    if (error) return cellarError(error.message, 400);

    const previousBucket = asset.storage_bucket || bucketName;
    const previousPath = asset.storage_path;
    if (previousPath) {
      await client.storage.from(previousBucket).remove([previousPath]);
    }

    return cellarJson({ cellar_asset: data });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_SWAP_ASSET_FILE_FAILED', 500);
  }
});
