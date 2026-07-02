import { cellarCorsHeaders, cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarServiceClient } from '../_shared/cellar_supabase.ts';

const defaultBucketName = 'cellar_investor_assets';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const assetId = String(body.asset_id ?? '').trim();
    const downloadFileName = String(body.cellar_download_filename ?? '').trim();
    const shouldDownload = Boolean(body.cellar_download);
    if (!assetId) return cellarError('CELLAR_ASSET_ID_REQUIRED', 400);

    const client = cellarServiceClient();
    const { data: asset, error } = await client
      .from('cellar_assets')
      .select('id, title, visibility, status, storage_bucket, storage_path, investor_kb_scope')
      .eq('id', assetId)
      .maybeSingle();

    if (error) return cellarError(error.message, 400);
    if (!asset) return cellarError('CELLAR_ASSET_NOT_FOUND', 404);
    if (asset.status !== 'published') return cellarError('CELLAR_ASSET_NOT_PUBLISHED', 403);
    if (asset.investor_kb_scope !== 'investor_kb') return cellarError('CELLAR_ASSET_SCOPE_DENIED', 403);
    if (!asset.storage_path) return cellarError('CELLAR_ASSET_FILE_MISSING', 404);

    const signedUrlOptions = downloadFileName ? { download: downloadFileName } : undefined;
    const { data, error: signedUrlError } = await client.storage
      .from(asset.storage_bucket || defaultBucketName)
      .createSignedUrl(asset.storage_path, 60 * 30, signedUrlOptions);

    if (signedUrlError || !data?.signedUrl) {
      return cellarError(signedUrlError?.message || 'CELLAR_SIGNED_URL_FAILED', 400);
    }

    if (shouldDownload) {
      const fileResponse = await fetch(data.signedUrl);
      if (!fileResponse.ok) return cellarError('CELLAR_ASSET_DOWNLOAD_FAILED', 502);
      const fileBytes = await fileResponse.arrayBuffer();
      const fileName = downloadFileName || asset.storage_path.split('/').at(-1) || 'cellar-presentation.pdf';
      return new Response(fileBytes, {
        status: 200,
        headers: {
          ...cellarCorsHeaders,
          'Content-Type': fileResponse.headers.get('Content-Type') ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
          'Cache-Control': 'private, max-age=0, no-store',
        },
      });
    }

    const signedUrl = new URL(data.signedUrl);
    if (downloadFileName) {
      signedUrl.searchParams.set('download', downloadFileName);
    }

    return cellarJson({ signed_url: signedUrl.toString() });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_GET_ASSET_URL_FAILED', 500);
  }
});
