export const cellarCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function cellarHandleOptions(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cellarCorsHeaders });
  }
  return null;
}
