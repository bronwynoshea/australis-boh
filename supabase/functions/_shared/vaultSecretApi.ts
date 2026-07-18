import {
  decodeMasterKey,
  decryptProtectedValue,
  encryptProtectedValue,
  generateWrappedTenantKey,
  unwrapTenantKey,
  type ProtectedValueEnvelope,
} from './vaultCrypto.ts';

export type VaultTenantKeyEnvelope = {
  tenantKeyId: string;
  wrappedKey: string;
  wrappingKeyRef: string;
  algorithm: string;
};

export type VaultStoredSecretEnvelope = ProtectedValueEnvelope & {
  secretVersionId: string;
  tenantKeyId: string;
  wrappedKey: string;
  wrappingKeyRef: string;
  tenantKeyAlgorithm: string;
  secretAlgorithm: 'AES-256-GCM';
};

type Actor = { id: string };
type ActorInput = { tenantId: string; actorId: string; environment: 'development'; requestId: string };

export type VaultSecretDependencies = {
  masterKeyBase64: string;
  serviceIdentity: string;
  resolveActor(authorization: string, tenantId: string): Promise<Actor>;
  getActiveTenantKey(input: ActorInput): Promise<VaultTenantKeyEnvelope | null>;
  initializeTenantKey(input: ActorInput & { wrappedKey: string; wrappingKeyRef: string }): Promise<VaultTenantKeyEnvelope>;
  commitSecretVersion(input: ActorInput & {
    itemId: string;
    fieldId: string;
    tenantKeyId: string;
    ciphertext: string;
    nonce: string;
    wrappedDataKey: string;
    algorithm: 'AES-256-GCM';
  }): Promise<string>;
  readSecretEnvelope(input: ActorInput & {
    itemId: string;
    fieldId: string;
    auditEvent: 'revealed' | 'copied';
  }): Promise<VaultStoredSecretEnvelope>;
};

export class VaultApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, internalMessage?: string) {
    super(internalMessage ?? code);
    this.status = status;
    this.code = code;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WRAPPING_KEY_REFERENCE = 'env:BOH_VAULT_MASTER_KEY_V1';

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

function publicError(error: unknown): Response {
  if (error instanceof VaultApiError) {
    const message = error.status === 401
      ? 'Authentication is required.'
      : error.status === 403
      ? 'You do not have access to this Vault action.'
      : error.status === 404
      ? 'The requested Vault value was not found.'
      : error.status === 409
      ? 'The Vault value changed. Refresh and try again.'
      : 'The Vault request is invalid.';
    return json(error.status, { ok: false, error: message });
  }
  return json(500, { ok: false, error: 'Vault is temporarily unavailable.' });
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new VaultApiError(400, 'invalid_request', `${field} must be a UUID`);
  }
  return value;
}

function requiredText(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) {
    throw new VaultApiError(400, 'invalid_request', `${field} is required`);
  }
  return value;
}

function fieldContext(tenantId: string, itemId: string, fieldId: string): string {
  return `tenant:${tenantId}/item:${itemId}/field:${fieldId}`;
}

export function createVaultSecretHandler(dependencies: VaultSecretDependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST') throw new VaultApiError(400, 'invalid_request');
      let body: Record<string, unknown>;
      try {
        const parsed = await request.json() as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Invalid JSON object');
        }
        body = parsed as Record<string, unknown>;
      } catch {
        throw new VaultApiError(400, 'invalid_request');
      }

      const action = body.action;
      if (action !== 'set' && action !== 'reveal' && action !== 'copy') {
        throw new VaultApiError(400, 'invalid_request');
      }
      if (body.environment !== 'development') {
        throw new VaultApiError(400, 'development_only');
      }

      const tenantId = requiredUuid(body.tenantId, 'tenantId');
      const itemId = requiredUuid(body.itemId, 'itemId');
      const fieldId = requiredUuid(body.fieldId, 'fieldId');
      const requestId = requiredText(body.requestId, 'requestId');
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new VaultApiError(401, 'unauthorized');

      const actor = await dependencies.resolveActor(authorization, tenantId);
      const common: ActorInput = {
        tenantId,
        actorId: actor.id,
        environment: 'development',
        requestId,
      };
      const masterKey = decodeMasterKey(dependencies.masterKeyBase64);
      const context = fieldContext(tenantId, itemId, fieldId);

      if (action === 'set') {
        const value = requiredText(body.value, 'value', 131_072);
        let tenantKeyEnvelope = await dependencies.getActiveTenantKey(common);
        if (!tenantKeyEnvelope) {
          const wrappedKey = await generateWrappedTenantKey(masterKey);
          tenantKeyEnvelope = await dependencies.initializeTenantKey({
            ...common,
            wrappedKey,
            wrappingKeyRef: WRAPPING_KEY_REFERENCE,
          });
        }
        if (tenantKeyEnvelope.algorithm !== 'AES-256-GCM') {
          throw new Error('Unsupported tenant-key algorithm');
        }
        const tenantKey = await unwrapTenantKey(masterKey, tenantKeyEnvelope.wrappedKey);
        const encrypted = await encryptProtectedValue(tenantKey, value, context);
        const secretVersionId = await dependencies.commitSecretVersion({
          ...common,
          itemId,
          fieldId,
          tenantKeyId: tenantKeyEnvelope.tenantKeyId,
          ...encrypted,
        });
        return json(200, { ok: true, secretVersionId });
      }

      const stored = await dependencies.readSecretEnvelope({
        ...common,
        itemId,
        fieldId,
        auditEvent: action === 'copy' ? 'copied' : 'revealed',
      });
      if (stored.tenantKeyAlgorithm !== 'AES-256-GCM' || stored.secretAlgorithm !== 'AES-256-GCM') {
        throw new Error('Unsupported Vault envelope algorithm');
      }
      const tenantKey = await unwrapTenantKey(masterKey, stored.wrappedKey);
      const value = await decryptProtectedValue(tenantKey, {
        ciphertext: stored.ciphertext,
        nonce: stored.nonce,
        wrappedDataKey: stored.wrappedDataKey,
        algorithm: stored.secretAlgorithm,
      }, context);
      return json(200, { ok: true, value, secretVersionId: stored.secretVersionId });
    } catch (error) {
      return publicError(error);
    }
  };
}
