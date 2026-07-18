export type VaultWebhookPayload = {
  runId: string;
  destinationKey: string;
  value: string;
};

export type NonceStore = {
  /** Atomically stores a fresh nonce. Returns false when it was already consumed. */
  consume(nonce: string, expiresAt: number): Promise<boolean>;
};

type SigningInput = VaultWebhookPayload & {
  url: string;
  timestamp: number;
  nonce: string;
};

const encoder = new TextEncoder();

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid webhook signature');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function sign(signingKey: Uint8Array, canonical: string): Promise<Uint8Array> {
  if (signingKey.byteLength !== 32) throw new Error('Webhook signing key must be exactly 32 bytes');
  const key = await crypto.subtle.importKey(
    'raw',
    asArrayBuffer(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, asArrayBuffer(encoder.encode(canonical))));
}

function canonical(timestamp: string, nonce: string, url: string, body: string): string {
  return `${timestamp}.${nonce}.${url}.${body}`;
}

export async function createSignedWebhookRequest(
  input: SigningInput,
  signingKey: Uint8Array,
): Promise<Request> {
  if (!Number.isSafeInteger(input.timestamp) || input.timestamp <= 0) throw new Error('Invalid webhook timestamp');
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(input.nonce)) throw new Error('Invalid webhook nonce');
  const body = JSON.stringify({
    runId: input.runId,
    destinationKey: input.destinationKey,
    value: input.value,
  });
  const timestamp = String(input.timestamp);
  const signature = await sign(signingKey, canonical(timestamp, input.nonce, input.url, body));
  return new Request(input.url, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-boh-vault-timestamp': timestamp,
      'x-boh-vault-nonce': input.nonce,
      'x-boh-vault-signature': `v1=${bytesToHex(signature)}`,
    },
    body,
  });
}

export async function verifySignedWebhookRequest(
  request: Request,
  signingKey: Uint8Array,
  options: { now: number; maxSkewSeconds: number; nonces: NonceStore },
): Promise<VaultWebhookPayload> {
  const timestampHeader = request.headers.get('x-boh-vault-timestamp') ?? '';
  const nonce = request.headers.get('x-boh-vault-nonce') ?? '';
  const signatureHeader = request.headers.get('x-boh-vault-signature') ?? '';
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(options.now - timestamp) > options.maxSkewSeconds) {
    throw new Error('Webhook timestamp is expired');
  }
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(nonce)) throw new Error('Invalid webhook nonce');
  if (!signatureHeader.startsWith('v1=')) throw new Error('Invalid webhook signature');

  const body = await request.text();
  const expected = await sign(signingKey, canonical(timestampHeader, nonce, request.url, body));
  const supplied = hexToBytes(signatureHeader.slice(3));
  if (!constantTimeEqual(expected, supplied)) throw new Error('Invalid webhook signature');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('Invalid webhook payload');
  }
  if (
    typeof payload !== 'object' || payload === null ||
    typeof (payload as Record<string, unknown>).runId !== 'string' ||
    typeof (payload as Record<string, unknown>).destinationKey !== 'string' ||
    typeof (payload as Record<string, unknown>).value !== 'string'
  ) {
    throw new Error('Invalid webhook payload');
  }

  const consumed = await options.nonces.consume(nonce, timestamp + options.maxSkewSeconds);
  if (!consumed) throw new Error('Webhook nonce replay detected');
  return payload as VaultWebhookPayload;
}
