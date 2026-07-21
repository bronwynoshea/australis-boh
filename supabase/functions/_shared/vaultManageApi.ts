import { VaultApiError } from './vaultSecretApi.ts';

type CommonInput = {
  tenantId: string;
  actorId: string;
  environment: 'development' | 'production';
  requestId: string;
};

type Operation = CommonInput & Record<string, unknown>;

export type VaultManageDependencies = {
  resolveActor(authorization: string, tenantId: string): Promise<{ id: string }>;
  upsertItem(input: Operation): Promise<string | undefined>;
  updateItemDetails(input: Operation): Promise<string | undefined>;
  upsertField(input: Operation): Promise<string | undefined>;
  deleteItem(input: Operation): Promise<void>;
  mutateGrant(input: Operation): Promise<string | undefined>;
  createTarget(input: Operation): Promise<string | undefined>;
  createBinding(input: Operation): Promise<string | undefined>;
  updateBinding(input: Operation): Promise<void>;
  requestSync(input: Operation): Promise<string | undefined>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set([
  'upsert_item', 'update_item_details', 'upsert_field', 'delete_item', 'mutate_grant', 'create_target',
  'create_binding', 'update_binding', 'request_sync',
]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      pragma: 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new VaultApiError(400, 'invalid_request');
  return value;
}

function text(value: unknown, max = 500): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new VaultApiError(400, 'invalid_request');
  }
  return value.trim();
}

function optionalText(value: unknown, max = 10_000): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new VaultApiError(400, 'invalid_request');
  return value;
}

function oneOf(value: unknown, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new VaultApiError(400, 'invalid_request');
  return value;
}

function metadata(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new VaultApiError(400, 'invalid_request');
  return value as Record<string, unknown>;
}

function publicError(error: unknown): Response {
  if (error instanceof VaultApiError) {
    if (error.status === 401) return json(401, { ok: false, error: 'Authentication is required.' });
    if (error.status === 403) return json(403, { ok: false, error: 'You do not have access to this Vault action.' });
    if (error.status === 404) return json(404, { ok: false, error: 'The requested Vault record was not found.' });
    if (error.status === 409) return json(409, { ok: false, error: 'This Vault change conflicts with a newer update.' });
    return json(400, { ok: false, error: 'The Vault request is invalid.' });
  }
  return json(500, { ok: false, error: 'Vault management is temporarily unavailable.' });
}

export function createVaultManageHandler(dependencies: VaultManageDependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST') throw new VaultApiError(400, 'invalid_request');
      let body: Record<string, unknown>;
      try {
        const parsed = await request.json() as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Invalid JSON object');
        body = parsed as Record<string, unknown>;
      } catch {
        throw new VaultApiError(400, 'invalid_request');
      }
      const environment = oneOf(body.environment, ['development', 'production']) as CommonInput['environment'];
      const action = text(body.action, 40);
      if (!ACTIONS.has(action)) throw new VaultApiError(400, 'invalid_request');
      const tenantId = uuid(body.tenantId);
      const requestId = text(body.requestId, 200);
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new VaultApiError(401, 'unauthorized');
      const actor = await dependencies.resolveActor(authorization, tenantId);
      const common: CommonInput = { tenantId, actorId: actor.id, environment, requestId };
      let id: string | undefined;

      if (action === 'upsert_item') {
        id = await dependencies.upsertItem({
          ...common,
          itemId: uuid(body.itemId),
          itemKey: text(body.itemKey, 160),
          displayName: text(body.displayName, 240),
          itemType: text(body.itemType, 80),
          providerKey: optionalText(body.providerKey, 120),
          projectWorkspace: optionalText(body.projectWorkspace, 240),
          projectId: optionalText(body.projectId, 500),
          serviceUrl: optionalText(body.serviceUrl, 2048),
          purpose: optionalText(body.purpose, 1000),
          description: optionalText(body.description),
          notes: optionalText(body.notes, 30_000),
        });
      } else if (action === 'update_item_details') {
        id = await dependencies.updateItemDetails({
          ...common,
          itemId: uuid(body.itemId),
          displayName: text(body.displayName, 240),
          providerKey: optionalText(body.providerKey, 120),
          projectWorkspace: optionalText(body.projectWorkspace, 240),
          projectId: optionalText(body.projectId, 500),
          serviceUrl: optionalText(body.serviceUrl, 2048),
          purpose: optionalText(body.purpose, 1000),
          description: optionalText(body.description, 10_000),
          protectedFieldId: body.protectedFieldId ? uuid(body.protectedFieldId) : null,
          referenceName: body.protectedFieldId ? text(body.referenceName, 160) : null,
        });
      } else if (action === 'upsert_field') {
        const fieldKind = oneOf(body.fieldKind, ['plaintext', 'protected']);
        const plaintextValue = optionalText(body.plaintextValue, 30_000);
        if (fieldKind === 'protected' && plaintextValue !== null) throw new VaultApiError(400, 'protected_value_boundary');
        id = await dependencies.upsertField({
          ...common,
          fieldId: uuid(body.fieldId),
          itemId: uuid(body.itemId),
          fieldKey: text(body.fieldKey, 160),
          label: text(body.label, 240),
          fieldKind,
          plaintextValue,
          isRequired: body.isRequired === true,
          sortOrder: Number.isInteger(body.sortOrder) ? body.sortOrder as number : 0,
          metadata: metadata(body.metadata),
        });
      } else if (action === 'delete_item') {
        await dependencies.deleteItem({
          ...common,
          itemId: uuid(body.itemId),
        });
      } else if (action === 'mutate_grant') {
        id = await dependencies.mutateGrant({
          ...common,
          grantId: uuid(body.grantId),
          bohUserId: uuid(body.bohUserId),
          role: oneOf(body.role, ['vault_admin', 'vault_editor', 'vault_viewer', 'sync_operator', 'gateway_operator']),
          status: oneOf(body.status, ['active', 'suspended', 'revoked']),
        });
      } else if (action === 'create_target') {
        id = await dependencies.createTarget({
          ...common,
          adapterId: uuid(body.adapterId),
          targetKey: text(body.targetKey, 160),
          displayName: text(body.displayName, 240),
          externalTargetRef: optionalText(body.externalTargetRef, 2000),
          metadata: metadata(body.metadata),
        });
      } else if (action === 'create_binding') {
        id = await dependencies.createBinding({
          ...common,
          itemId: uuid(body.itemId),
          fieldId: uuid(body.fieldId),
          targetId: uuid(body.targetId),
          destinationKey: text(body.destinationKey, 240),
          syncMode: oneOf(body.syncMode, ['runtime_secret_sync', 'brokered_execution', 'scoped_lease']),
        });
      } else if (action === 'update_binding') {
        await dependencies.updateBinding({
          ...common,
          bindingId: uuid(body.bindingId),
          state: oneOf(body.state, ['pending', 'ready', 'blocked', 'disabled', 'error']),
        });
      } else {
        id = await dependencies.requestSync({
          ...common,
          bindingId: uuid(body.bindingId),
          runRequestId: text(body.runRequestId, 200),
        });
      }

      return json(200, id ? { ok: true, id } : { ok: true });
    } catch (error) {
      return publicError(error);
    }
  };
}
