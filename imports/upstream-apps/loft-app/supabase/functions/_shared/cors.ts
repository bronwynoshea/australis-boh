export const corsHeaders = (origin: string | null) => {
  const normalizeOrigin = (value: string) =>
    value
      .trim()
      .replace(/\/\*$/, '')
      .replace(/\/$/, '');

  const configuredOrigins = (Deno.env.get('LOFT_ALLOWED_ORIGINS') || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  const requestOrigin = origin ? normalizeOrigin(origin) : '';
  const allowedOrigin = configuredOrigins.includes(requestOrigin) ? requestOrigin : '';

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Vary': 'Origin',
  };
};
