import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('active BOH guidance uses the Australis Development domain', () => {
  for (const path of [
    'AGENTS.md',
    'HERMES_CODEX_HANDOVER.md',
    'README.md',
    'supabase/manual_sql/20260621_australis_boh_dev_identity_bootstrap/README.md',
  ]) {
    const content = read(path);
    assert.match(content, /dev-boh\.australis\.cloud/, path);
    assert.doesNotMatch(content, /dev-boh\.jobzcafe\.com/, path);
  }
});

test('active BOH website routing recognizes the Australis Development domain only', () => {
  const content = read('src/apps/website/App.tsx');
  assert.match(content, /dev-boh\.australis\.cloud/);
  assert.doesNotMatch(content, /dev-boh\.jobzcafe\.com/);
});
