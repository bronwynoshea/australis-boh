import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

type CellarAssetForExtraction = {
  id: string;
  title: string;
  tab_label: string | null;
  visibility: string;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  sort_order: number | null;
};

type ExtractedQa = {
  question?: unknown;
  answer?: unknown;
  topic?: unknown;
  visibility?: unknown;
  related_asset_id?: unknown;
};

const maxFileBytes = 50 * 1024 * 1024;
const defaultBucketName = 'cellar_investor_assets';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function parseModelJson(text: string): ExtractedQa[] {
  const cleanText = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleanText);
  return Array.isArray(parsed?.qas) ? parsed.qas : [];
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const openAiKey = Deno.env.get('CELLAR_OPENAI_API_KEY') ?? Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) return cellarError('CELLAR_QA_EXTRACTION_KEY_MISSING', 500);

    const body = await request.json().catch(() => ({}));
    const presentationId = normalizeText(body.cellar_presentation_id);
    if (!presentationId) return cellarError('CELLAR_PRESENTATION_REQUIRED', 400);

    const client = cellarServiceClient();
    const { data: presentation, error: presentationError } = await client
      .from('cellar_presentations')
      .select('id, title, description')
      .eq('id', presentationId)
      .neq('status', 'archived')
      .single();
    if (presentationError || !presentation) return cellarError('CELLAR_PRESENTATION_NOT_FOUND', 404);

    const { data: assets, error: assetsError } = await client
      .from('cellar_assets')
      .select('id, title, tab_label, visibility, storage_bucket, storage_path, mime_type, sort_order')
      .eq('presentation_id', presentationId)
      .neq('status', 'archived')
      .order('sort_order', { ascending: true });
    if (assetsError) return cellarError(assetsError.message, 400);

    const downloadableAssets = ((assets ?? []) as CellarAssetForExtraction[]).filter((asset) =>
      asset.storage_path &&
      asset.mime_type === 'application/pdf'
    );
    if (!downloadableAssets.length) return cellarError('CELLAR_EXTRACTABLE_PDF_REQUIRED', 400);

    const content: Array<Record<string, unknown>> = [{
      type: 'input_text',
      text: [
        'Create reusable investor Q&A cards from the uploaded CELLAR pitch material.',
        'Use only the supplied file content. Do not invent facts.',
        'Do not write slide-specific questions.',
        'Do not mention slide numbers, deck sections, or phrases like "what should investors know".',
        'The questions should work across multiple pitch rooms and be common investor questions about the company, product, market, wedge, scale, moat, timing, risk, business model, competition, and team.',
        'Return JSON only with this shape:',
        '{"qas":[{"question":"...","answer":"...","topic":"...","visibility":"guest|verified","related_asset_id":"asset id"}]}',
        'Prefer direct founder-style answers that are concise, defensible, and suitable for an investor-facing Q&A library.',
        'Create 8 to 15 useful Q&As across the company and product story.',
        `Presentation: ${presentation.title}`,
        presentation.description ? `Description: ${presentation.description}` : '',
        'Assets:',
        ...downloadableAssets.map((asset) =>
          `${asset.id}: ${asset.tab_label || asset.title} (${asset.visibility})`
        ),
      ].filter(Boolean).join('\n'),
    }];

    for (const asset of downloadableAssets) {
      const { data: fileData, error: fileError } = await client.storage
        .from(asset.storage_bucket || defaultBucketName)
        .download(asset.storage_path || '');
      if (fileError || !fileData) return cellarError(fileError?.message || 'CELLAR_ASSET_FILE_MISSING', 400);

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      if (bytes.byteLength > maxFileBytes) return cellarError('CELLAR_ASSET_FILE_TOO_LARGE', 400);
      content.push({
        type: 'input_file',
        filename: `${asset.tab_label || asset.title}.pdf`,
        file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}`,
      });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('CELLAR_QA_EXTRACTION_MODEL') ?? 'gpt-4o-mini',
        input: [{ role: 'user', content }],
      }),
    });
    const modelResult = await response.json();
    if (!response.ok) return cellarError(modelResult?.error?.message || 'CELLAR_QA_EXTRACTION_FAILED', 502);

    const outputText = normalizeText(modelResult.output_text)
      || normalizeText(modelResult.output?.[0]?.content?.[0]?.text);
    if (!outputText) return cellarError('CELLAR_QA_EXTRACTION_EMPTY', 502);

    const assetIds = new Set(downloadableAssets.map((asset) => asset.id));
    const extractedQas = parseModelJson(outputText)
      .map((qa, index) => {
        const relatedAssetId = normalizeText(qa.related_asset_id);
        const visibility = normalizeText(qa.visibility);
        return {
          question: normalizeText(qa.question),
          answer: normalizeText(qa.answer),
          topic: normalizeText(qa.topic) || null,
          visibility: ['guest', 'verified'].includes(visibility) ? visibility : 'guest',
          related_asset_id: assetIds.has(relatedAssetId) ? relatedAssetId : downloadableAssets[0].id,
          status: 'needs_review',
          sort_order: (index + 1) * 10,
          investor_kb_scope: 'investor_kb',
          created_by_boh_user_id: staffUser.bohUserId,
          updated_by_boh_user_id: staffUser.bohUserId,
        };
      })
      .filter((qa) => qa.question && qa.answer)
      .slice(0, 20);

    if (!extractedQas.length) return cellarError('CELLAR_QA_EXTRACTION_EMPTY', 502);

    const { data: inserted, error: insertError } = await client
      .from('cellar_prepared_qa')
      .insert(extractedQas)
      .select('id, question, status, visibility, related_asset_id');
    if (insertError) return cellarError(insertError.message, 400);

    return cellarJson({
      cellar_prepared_qa_count: inserted?.length ?? 0,
      cellar_prepared_qa: inserted ?? [],
    }, 201);
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_QA_EXTRACTION_FAILED', 500);
  }
});
