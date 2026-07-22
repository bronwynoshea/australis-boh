import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  formatSwitchboardStatus,
  normalizeSwitchboardKey,
  resolveSwitchboardProvider,
  switchboardProjectMatchesSearch,
} from '../src/apps/switchboard/switchboardModel.ts';

const project = {
  id: 'project-1', tenant_id: 'tenant-1', project_key: 'jobzcafe', name: 'JOBZCAFE',
  description: 'Recruitment products', status: 'active', created_at: '', updated_at: '',
};
const connection = {
  id: 'connection-1', tenant_id: 'tenant-1', connection_key: 'cloudflare-jobzcafe', provider: 'cloudflare',
  environment_scope: 'production',
  display_name: 'Cloudflare', external_account_id: null, external_account_name: null,
  credential_vault_item_id: null, status: 'needs_setup', last_checked_at: null,
  last_error_summary: null, created_at: '', updated_at: '',
};
const resource = {
  id: 'resource-1', tenant_id: 'tenant-1', project_id: 'project-1', connection_id: 'connection-1',
  environment_scope: 'production', resource_kind: 'pages_project', display_name: 'JOBZCAFE Pages',
  external_resource_id: 'jobzcafe', service_url: 'https://jobzcafe.pages.dev', status: 'active',
  created_at: '', updated_at: '',
};

test('Switchboard keys use stable lowercase identifier syntax', () => {
  assert.equal(normalizeSwitchboardKey(' JOBZCAFE Production '), 'jobzcafe-production');
});

test('project search includes linked resource names, identifiers, and URLs', () => {
  assert.equal(switchboardProjectMatchesSearch(project, [resource], 'pages'), true);
  assert.equal(switchboardProjectMatchesSearch(project, [resource], 'jobzcafe.pages.dev'), true);
  assert.equal(switchboardProjectMatchesSearch(project, [resource], 'australis'), false);
});

test('resource provider resolves through its account connection', () => {
  assert.equal(resolveSwitchboardProvider(resource, [connection]), 'cloudflare');
  assert.equal(resolveSwitchboardProvider({ ...resource, connection_id: 'missing' }, [connection]), 'other');
});

test('Switchboard status labels are readable', () => {
  assert.equal(formatSwitchboardStatus('needs_setup'), 'Needs Setup');
});

test('new project form stays user-facing and does not expose the internal project key', () => {
  const source = readFileSync(new URL('../src/apps/switchboard/SwitchboardApp.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, />Project key</);
  assert.doesNotMatch(source, /placeholder="JOBZCAFE®"/);
  assert.doesNotMatch(source, /Development and Production environments will be created automatically/);
  assert.match(source, /link each Development and Production service using its own project ID/);
  assert.match(source, /const \[name, setName\] = useState\(''\)/);
});
