const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const AES_GCM = 'AES-GCM';
const ENVELOPE_PREFIX = 'v1';

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

export type ProtectedValueEnvelope = {
  ciphertext: string;
  nonce: string;
  wrappedDataKey: string;
  algorithm: 'AES-256-GCM';
};

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new Error('Value must be canonical base64');
  }
  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('Value must be canonical base64');
  }
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function importAesKey(rawKey: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  if (rawKey.byteLength !== 32) throw new Error('AES-256 keys must be exactly 32 bytes');
  return crypto.subtle.importKey('raw', asArrayBuffer(rawKey), { name: AES_GCM }, false, usages);
}

async function encryptBytes(
  rawKey: Uint8Array,
  plaintext: Uint8Array,
  additionalData?: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const nonce = randomBytes(12);
  const key = await importAesKey(rawKey, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: AES_GCM,
      iv: asArrayBuffer(nonce),
      additionalData: additionalData ? asArrayBuffer(additionalData) : undefined,
    },
    key,
    asArrayBuffer(plaintext),
  );
  return { ciphertext: new Uint8Array(ciphertext), nonce };
}

async function decryptBytes(
  rawKey: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  additionalData?: Uint8Array,
): Promise<Uint8Array> {
  const key = await importAesKey(rawKey, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: AES_GCM,
      iv: asArrayBuffer(nonce),
      additionalData: additionalData ? asArrayBuffer(additionalData) : undefined,
    },
    key,
    asArrayBuffer(ciphertext),
  );
  return new Uint8Array(plaintext);
}

function encodeWrappedKey(nonce: Uint8Array, ciphertext: Uint8Array): string {
  return `${ENVELOPE_PREFIX}.${encodeBase64(nonce)}.${encodeBase64(ciphertext)}`;
}

function decodeWrappedKey(value: string): { nonce: Uint8Array; ciphertext: Uint8Array } {
  const [version, nonce, ciphertext, extra] = value.split('.');
  if (version !== ENVELOPE_PREFIX || !nonce || !ciphertext || extra !== undefined) {
    throw new Error('Unsupported wrapped-key envelope');
  }
  const decodedNonce = decodeBase64(nonce);
  if (decodedNonce.byteLength !== 12) throw new Error('Wrapped-key nonce must be 12 bytes');
  return { nonce: decodedNonce, ciphertext: decodeBase64(ciphertext) };
}

export function decodeMasterKey(base64Key: string): Uint8Array {
  const key = decodeBase64(base64Key);
  if (key.byteLength !== 32) throw new Error('Vault master key must be exactly 32 bytes');
  return key;
}

export async function generateWrappedTenantKey(masterKey: Uint8Array): Promise<string> {
  const tenantKey = randomBytes(32);
  const encrypted = await encryptBytes(masterKey, tenantKey, encoder.encode('boh-vault:tenant-key:v1'));
  return encodeWrappedKey(encrypted.nonce, encrypted.ciphertext);
}

export async function unwrapTenantKey(masterKey: Uint8Array, wrappedKey: string): Promise<Uint8Array> {
  const envelope = decodeWrappedKey(wrappedKey);
  const tenantKey = await decryptBytes(
    masterKey,
    envelope.ciphertext,
    envelope.nonce,
    encoder.encode('boh-vault:tenant-key:v1'),
  );
  if (tenantKey.byteLength !== 32) throw new Error('Unwrapped tenant key must be exactly 32 bytes');
  return tenantKey;
}

export async function encryptProtectedValue(
  tenantKey: Uint8Array,
  value: string,
  fieldContext: string,
): Promise<ProtectedValueEnvelope> {
  if (!fieldContext.trim()) throw new Error('Field encryption context is required');
  const dataKey = randomBytes(32);
  const additionalData = encoder.encode(`boh-vault:protected-value:v1:${fieldContext}`);
  const encryptedValue = await encryptBytes(dataKey, encoder.encode(value), additionalData);
  const encryptedDataKey = await encryptBytes(
    tenantKey,
    dataKey,
    encoder.encode(`boh-vault:data-key:v1:${fieldContext}`),
  );
  return {
    ciphertext: encodeBase64(encryptedValue.ciphertext),
    nonce: encodeBase64(encryptedValue.nonce),
    wrappedDataKey: encodeWrappedKey(encryptedDataKey.nonce, encryptedDataKey.ciphertext),
    algorithm: 'AES-256-GCM',
  };
}

export async function decryptProtectedValue(
  tenantKey: Uint8Array,
  envelope: ProtectedValueEnvelope,
  fieldContext: string,
): Promise<string> {
  if (envelope.algorithm !== 'AES-256-GCM') throw new Error('Unsupported protected-value algorithm');
  const wrappedDataKey = decodeWrappedKey(envelope.wrappedDataKey);
  const dataKey = await decryptBytes(
    tenantKey,
    wrappedDataKey.ciphertext,
    wrappedDataKey.nonce,
    encoder.encode(`boh-vault:data-key:v1:${fieldContext}`),
  );
  const nonce = decodeBase64(envelope.nonce);
  if (nonce.byteLength !== 12) throw new Error('Protected-value nonce must be 12 bytes');
  const plaintext = await decryptBytes(
    dataKey,
    decodeBase64(envelope.ciphertext),
    nonce,
    encoder.encode(`boh-vault:protected-value:v1:${fieldContext}`),
  );
  return decoder.decode(plaintext);
}
