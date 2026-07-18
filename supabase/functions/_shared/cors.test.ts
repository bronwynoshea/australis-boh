import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCorsHeaders, corsHeaders, handleCors, jsonResponse } from './cors.ts';

test('shared CORS contract supports Vault browser preflight and JSON responses', async () => {
  const request = new Request('https://edge.example.test', {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:5174' },
  });
  const headers = buildCorsHeaders(request, { allowMethods: ['POST', 'OPTIONS'] });
  assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:5174');
  assert.equal(headers['Access-Control-Allow-Methods'], 'POST,OPTIONS');
  assert.equal(handleCors(request, { allowMethods: ['POST', 'OPTIONS'] })?.status, 204);

  const response = jsonResponse(request, { ok: true }, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5174');
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(typeof corsHeaders, 'function');
});
