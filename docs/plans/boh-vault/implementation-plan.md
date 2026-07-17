# BOH Vault Implementation Plan

Status: reconciled architecture plan
Scope: planning only; implementation sequencing is coordinated separately

## Delivery principles

1. Build a real tenant-scoped Vault slice, not a metadata-only registry or a mock-first endpoint.
2. Store ordinary item descriptions, instructions, labels, and notes as plaintext metadata. Encrypt only protected fields such as passwords, private keys, tokens, signing secrets, recovery codes, and fields explicitly marked protected.
3. Keep ciphertext, wrapped keys, and decrypted values behind a protected service boundary. Browser list/detail queries receive safe metadata only; reveal/copy is explicit, authorized, and audited.
4. Treat BOH Vault as the source of truth for secret values, versions, rotation, references, and synchronization. It does not own canonical AI routes or product policy.
5. Keep Gateway ownership with each product:
   - JOBZCAFE® owns its Gateway routes, provider/model policy, credits, allowances, and product behavior.
   - Australis owns its Gateway routes/runtime and Hermes runner dispatch.
6. Keep deployment and synchronization provider-neutral. Supabase functions, Cloudflare Workers, runner environments, signed webhooks, and future adapters are supported targets, not required architecture.
7. Do not require Cloudflare AI Gateway or Cloudflare Tunnel.

## Phase 1: Secure vertical slice

Goal: prove the complete security boundary with persisted data before broad UI expansion.

Build:

- Tenant-scoped vault items, versions, fields, credential references, key versions, and audit events.
- Plaintext metadata fields for title, description, notes, tags, ownership, environment, and usage guidance.
- Field-level classification so only protected fields are encrypted.
- Protected create/update/reveal/copy operations for one representative secret type.
- Compact BOH Vault list, filters, detail drawer, and add/edit flow backed by persisted data.
- Role and tenant checks at the protected boundary.
- Envelope-encryption metadata and a development key-custody implementation that can be replaced without changing product contracts.

Acceptance:

- A protected value can be created, encrypted, versioned, revealed/copied by an authorized user, and audited end to end.
- Notes and descriptions remain searchable plaintext unless a field is explicitly marked protected.
- Unauthorized users and broad browser queries cannot retrieve ciphertext or plaintext secrets.
- No raw secret appears in source, fixtures, screenshots, logs, or documentation.

## Phase 2: Vault product workflows

Build:

- Password/login, service/API key, webhook signing secret, SSH/deploy material, certificate, recovery record, and custom-field templates.
- Per-field protection rather than encrypting an entire item or requiring a “secure note” type.
- Version history, expiry, rotation status, disable/archive, collections, and access grants.
- Re-authentication or stronger approval rules for sensitive production actions.
- Search/filter over safe metadata and plaintext notes.
- Audit views for item, value, access, key, and synchronization events.

Acceptance:

- Operators can manage useful records without forcing normal notes into encrypted blobs.
- Every protected-value read/write and permission-changing action is auditable.
- Development and production data are visibly separated while sharing one governed Vault.

## Phase 3: Provider-neutral delivery and synchronization

Build a stable Vault delivery contract that supports, per credential class:

1. **Brokered execution** — the protected service uses the credential without releasing it.
2. **Short-lived scoped lease** — an authorized runtime receives temporary, auditable access.
3. **Managed synchronization** — Vault pushes or rotates a value in an approved runtime secret store.

Adapter targets may include:

- Supabase functions/runtime secrets;
- Cloudflare Workers secrets;
- Australis/Hermes runner environments;
- signed webhook consumers;
- future product or infrastructure adapters.

Requirements:

- Adapter identity, destination, environment, scope, last synchronization, version, and health are tracked without making the adapter canonical.
- Synchronization payloads are authenticated, replay-resistant where applicable, and never logged.
- Signed webhook delivery includes timestamp/nonce validation, bounded retries, and audit events.
- Provider-specific details stay inside adapters.
- Inventory-only records are allowed only as an explicit migration exception for externally owned or non-exportable credentials, not as the target Vault model.

Acceptance:

- The same Vault reference can be delivered through different approved adapters without changing product route definitions.
- Rotation updates configured destinations and records success/failure per target.
- No design depends on Cloudflare AI Gateway, Cloudflare Tunnel, or any single hosting provider.

## Phase 4: Product-owned Gateway integrations

### JOBZCAFE® Gateway

- JOBZCAFE® retains its canonical route keys, provider/model policy, fallbacks, credits, allowances, and user-facing behavior.
- Its Gateway resolves approved BOH Vault credential references through the delivery contract.
- BOH Vault reports credential and synchronization health; it does not edit or become the source of JOBZCAFE® routes.

### Australis Gateway and Hermes dispatch

- Australis retains its canonical Gateway routes, provider/model policy, runtime execution, and Hermes runner dispatch.
- The Australis Gateway and runners consume approved Vault references through brokered, leased, or synchronized access.
- BOH Vault reports credential and destination health; it does not own Australis route definitions or dispatch policy.

Acceptance:

- Each product can change routes or providers without changing Vault ownership.
- Vault can rotate a credential without becoming the route registry.
- Product UIs show linked credential readiness but do not expose raw values in normal Gateway workflows.

## Production hardening

- Decide production root-key custody and recovery before production values are stored.
- Test key rotation separately from recovery; losing the sole decrypting/recovery key is not repairable through a UI reset.
- Verify tenant isolation, role policy, audit completeness, redaction, rate limits, replay protection, and destination rollback.
- Add adapter conformance tests and incident procedures for failed or partial synchronization.
- Require explicit approval for production data, secret, or infrastructure changes.
