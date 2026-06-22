import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarPresentationColleagueEmail, cellarSendEmail } from '../_shared/cellar_email.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarServiceClient } from '../_shared/cellar_supabase.ts';

const defaultBucketName = 'cellar_investor_assets';

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const colleagueEmail = normalizeEmail(body.cellar_colleague_email);
    const presentationTitle = String(body.cellar_presentation_title ?? 'CELLAR presentation').trim();
    const assetId = String(body.cellar_asset_id ?? '').trim();

    if (!isValidEmail(colleagueEmail)) return cellarError('CELLAR_COLLEAGUE_EMAIL_INVALID', 400);
    if (!assetId) return cellarError('CELLAR_ASSET_ID_REQUIRED', 400);

    const client = cellarServiceClient();
    const { data: asset, error: assetError } = await client
      .from('cellar_assets')
      .select('id, title, status, storage_bucket, storage_path, mime_type, investor_kb_scope')
      .eq('id', assetId)
      .maybeSingle();

    if (assetError) return cellarError(assetError.message, 400);
    if (!asset) return cellarError('CELLAR_ASSET_NOT_FOUND', 404);
    if (asset.status !== 'published') return cellarError('CELLAR_ASSET_NOT_PUBLISHED', 403);
    if (asset.investor_kb_scope !== 'investor_kb') return cellarError('CELLAR_ASSET_SCOPE_DENIED', 403);
    if (!asset.storage_path) return cellarError('CELLAR_ASSET_FILE_MISSING', 404);
    if (asset.mime_type !== 'application/pdf' && !asset.storage_path.toLowerCase().endsWith('.pdf')) {
      return cellarError('CELLAR_PRESENTATION_PDF_REQUIRED', 400);
    }

    const { data: signedUrlData, error: signedUrlError } = await client.storage
      .from(asset.storage_bucket || defaultBucketName)
      .createSignedUrl(asset.storage_path, 60 * 60 * 24 * 7);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return cellarError(signedUrlError?.message || 'CELLAR_SIGNED_URL_FAILED', 400);
    }

    const emailResult = await cellarSendEmail(cellarPresentationColleagueEmail({
      to: colleagueEmail,
      presentationTitle: presentationTitle || 'CELLAR presentation',
      presentationUrl: signedUrlData.signedUrl,
    }));

    if (!emailResult.sent) {
      return cellarError(emailResult.reason || 'CELLAR_PRESENTATION_EMAIL_SEND_FAILED', 502);
    }

    return cellarJson({
      cellar_email_sent: true,
    });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_PRESENTATION_EMAIL_FAILED', 500);
  }
});
