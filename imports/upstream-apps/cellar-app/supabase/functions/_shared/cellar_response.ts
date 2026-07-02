import { cellarCorsHeaders } from './cellar_cors.ts';

export function cellarJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cellarCorsHeaders, 'Content-Type': 'application/json' },
  });
}

export function cellarError(message: string, status = 400): Response {
  return cellarJson({ error: message }, status);
}
