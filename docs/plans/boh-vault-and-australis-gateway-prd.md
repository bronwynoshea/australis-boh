# BOH Vault and Product-Owned Gateway PRD

Status: reconciled planning baseline
Scope: BOH Vault, provider-neutral secret delivery, JOBZCAFE® Gateway integration, Australis Gateway integration, and Hermes runner dispatch
Owner: Australis / BOH platform operations

## 1. Product intent

BOH Vault is the governed, tenant-scoped source of truth for operational secret values used across Australis, BOH, JOBZCAFE®, and approved runtime destinations. It provides password-manager workflows, protected field storage, versioning, reveal/copy, rotation, audit, and synchronization without becoming the canonical route manager for any product.

Each product owns its own Gateway:

- **JOBZCAFE® owns its Gateway**, canonical route keys, provider/model policy, fallbacks, credits, allowances, and user-facing behavior.
- **Australis owns its Gateway**, canonical route keys, provider/model policy, runtime execution, and Hermes runner dispatch.

Core promise:

```text
BOH Vault protects and delivers credentials. JOBZCAFE® and Australis independently own the routes and policies that use them.
```

## 2. Product boundaries

### 2.1 BOH Vault owns secret management and delivery

BOH Vault is the system of record for:

- tenant-scoped vault items and stable non-secret references;
- protected values such as passwords, API/service keys, private keys, webhook signing secrets, recovery codes, certificates, and protected custom fields;
- value versions, expiry, rotation, disable/archive, and recovery metadata;
- grants, service identities, reveal/copy policy, and audit events;
- brokered use, short-lived leases, managed synchronization, and destination health;
- development and production environment separation;
- key versioning, wrapping, rotation, and recovery configuration.

Titles, descriptions, ordinary notes, tags, owners, environment labels, URLs, and usage guidance are plaintext metadata unless a field is explicitly classified as protected. The product does not require a special encrypted “secure note” item for ordinary notes.

### 2.2 BOH Vault does not own product routes

BOH Vault is not the canonical source for:

- JOBZCAFE® or Australis route keys;
- provider/model selection or fallback order;
- budgets, credits, allowances, or task policy;
- user-facing AI behavior;
- Work Session policy;
- Hermes runner selection or dispatch.

Vault records may state where a credential is used and report synchronization health. Those references do not transfer route ownership to Vault.

### 2.3 JOBZCAFE® owns its Gateway

JOBZCAFE® owns its Gateway endpoints, route definitions, provider/model adapters, fallback behavior, health policy, credits, allowances, and product behavior. Its Gateway resolves approved BOH Vault references using the provider-neutral delivery contract.

### 2.4 Australis owns its Gateway and Hermes dispatch

Australis owns its Gateway endpoints, route definitions, provider/model adapters, fallback behavior, Work Session/platform AI execution, and Hermes runner dispatch. The Australis Gateway and runners resolve approved BOH Vault references using the same provider-neutral delivery contract.

### 2.5 Provider-neutral deployment

The architecture supports multiple delivery targets and does not require any one vendor. Initial and future adapters may include:

- Supabase functions and runtime secret stores;
- Cloudflare Workers secret stores;
- Australis and Hermes runner environments;
- signed webhook consumers;
- future product, cloud, KMS/HSM, or private-runtime adapters.

Cloudflare AI Gateway and Cloudflare Tunnel are not requirements. If used later, they are optional adapters/infrastructure choices rather than architectural control points.

## 3. Users and service actors

### Vault admin

Creates items, manages protected fields, grants access, reveals/copies, rotates, synchronizes, disables, and reviews audit history for authorized tenants.

### Vault editor

Maintains permitted items and plaintext metadata. Protected production actions may require re-authentication or approval.

### Vault viewer

Reads safe metadata and status but cannot retrieve ciphertext or decrypted protected values.

### Product Gateway operator

Manages routes in the owning product and assigns approved Vault references without managing raw secrets inside the Gateway UI.

### Service identity / adapter

Uses a narrowly scoped capability for brokered execution, a short-lived lease, or synchronization to an approved destination. It does not receive general Vault browse/reveal authority.

### BOH platform owner

Administers tenant setup, key custody, explicit cross-tenant support workflows, recovery, and incident response. All elevated actions are audited.

## 4. Goals

1. Provide a real multi-tenant password manager for operational credentials.
2. Store actual protected values through secure workflows rather than stopping at inventory/status metadata.
3. Keep useful descriptions and notes searchable as plaintext while encrypting only protected fields.
4. Keep development and production records in one governed product with clear environment separation.
5. Support compact list/detail UX, protected reveal/copy, version history, rotation, and audit.
6. Deliver credentials through provider-neutral broker, lease, and synchronization contracts.
7. Preserve JOBZCAFE® ownership of its Gateway and product policy.
8. Preserve Australis ownership of its Gateway and Hermes runner dispatch.
9. Allow provider and deployment adapters to change without changing product route definitions or Vault ownership.

## 5. Deferred capabilities

These are later phases, not permanent non-goals:

- browser extension and autofill;
- broad import/export compatibility;
- attachments;
- passkeys/TOTP and enterprise identity integrations;
- customer-controlled recovery and advanced sharing;
- additional deployment, private-model, KMS/HSM, and infrastructure adapters.

Production secret writes remain blocked until production key custody, recovery, authorization, audit, and operational procedures are approved.

## 6. Information architecture and UX

### 6.1 BOH navigation

```text
Vault
Credentials, protected fields, access, rotation, and synchronization
```

### 6.2 Compact Vault list

Toolbar:

```text
[Search vault items…] [Type] [Tenant] [Environment] [Product] [Status] [+ Add item]
```

Columns:

- item;
- type;
- tenant/product;
- environment;
- used by;
- credential/sync status;
- updated;
- actions.

List queries contain safe metadata only. They never include ciphertext, wrapped keys, leases, or decrypted values.

### 6.3 Detail drawer

The drawer shows:

- plaintext title, description, notes, tags, owner, environment, and usage guidance;
- protected fields masked by default with authorized reveal/copy actions;
- versions, expiry, rotation policy, and last rotation;
- grants and service identities;
- destinations, synchronized version, last attempt, and health;
- audit history.

### 6.4 Add/edit flow

1. Select tenant, product ownership context, environment, and item template.
2. Enter plaintext metadata and ordinary notes.
3. Add fields and explicitly classify each as public/plaintext or protected.
4. Save through the appropriate safe metadata or protected-value boundary.
5. Record item, value, grant, and synchronization audit events.

### 6.5 Item templates

Templates may cover:

- password/login;
- service configuration;
- API/service key;
- AI provider credential;
- webhook signing secret;
- SSH/deploy material;
- certificate;
- recovery record;
- custom item.

Templates improve entry but do not determine whether an entire item is encrypted. Protection is field level.

## 7. Security and encryption requirements

1. Every item, version, grant, reference, audit event, key record, and synchronization target is tenant scoped.
2. Browser clients never select ciphertext, wrapped keys, or decrypted values directly.
3. Protected write/reveal/copy occurs only through an authenticated, authorized backend boundary.
4. Reveal/copy is explicit and audited; sensitive production actions may require re-authentication, approval, or both.
5. Plaintext notes and descriptions must reject accidental secret placement through UX guidance and optional detection, but they are not encrypted by default.
6. Only protected fields are encrypted at rest. Classification changes use a protected transition that avoids transient plaintext exposure.
7. No raw secret is committed to source, fixtures, docs, screenshots, analytics, or logs.
8. Rate limits, redaction, least privilege, and tenant isolation apply to human and service access.
9. Production changes require explicit approval.

### 7.1 Key hierarchy

Use envelope-encryption semantics:

```text
platform root key
  -> wraps tenant vault keys
      -> wrap item/version data-encryption keys
          -> encrypt protected field values
```

The root key must not live beside encrypted values in the same database. Track key versions on protected field versions. Active-key rotation and disaster recovery are separate capabilities: if all decrypting and recovery keys are lost, existing values must be re-entered from their original providers.

A development implementation may use a runtime-held root key while preserving the same tenant/key-version contracts. Production must select an approved custody and recovery model before storing production values.

## 8. Vault reference and delivery contract

### 8.1 Stable reference

Products use a non-secret reference such as:

```text
vault_reference_id
tenant_id
environment
purpose
required_capability
```

Provider name, destination details, ciphertext, and raw values are not embedded in product route definitions unless they are safe product-owned routing data.

### 8.2 Delivery modes

Choose per credential class and consumer:

1. **Brokered execution**: Vault or an authorized protected boundary performs the credential-backed action without releasing the value.
2. **Short-lived scoped lease**: an authorized runtime receives temporary, bounded, auditable access.
3. **Managed synchronization**: Vault writes/rotates the value in an approved runtime store and tracks destination version and health.

Inventory-only records are permitted only for migration or externally owned/non-exportable credentials. They are not the intended final product.

### 8.3 Adapter requirements

Every adapter must define:

- authenticated workload identity and tenant scope;
- destination and environment;
- supported delivery mode;
- idempotency and version semantics;
- rollback/partial-failure behavior;
- secret-safe logging and telemetry;
- rotation and revocation behavior;
- audit events and health reporting.

Signed webhook adapters must also provide timestamp/nonce validation, replay resistance, bounded retries, signature rotation, and a non-secret delivery identifier.

## 9. Product Gateway integrations

### 9.1 JOBZCAFE®

JOBZCAFE® route configuration stays in JOBZCAFE®. A route may link one or more Vault references. The Gateway resolves credentials at runtime or uses a synchronized destination. Vault returns readiness/version/sync health but does not modify route, provider, fallback, credit, or allowance policy.

### 9.2 Australis

Australis route configuration stays in Australis. The Gateway and Hermes dispatch path may link Vault references for provider execution and runner environments. Vault returns readiness/version/sync health but does not choose routes, models, runners, or dispatch policy.

### 9.3 Gateway UI behavior

Each product Gateway surface may show:

- route and provider/model policy owned by that product;
- linked Vault reference and environment;
- Ready / Needs credential / Sync failed / Rotation due states;
- setup, request-access, synchronize, or rotate actions that cross into Vault.

Normal Gateway workflows do not reveal raw protected values or manage password/login records.

## 10. Delivery plan

### Phase 1: secure vertical slice

- Persist tenant-scoped item/version/field/reference/audit/key records.
- Keep ordinary metadata plaintext and encrypt one representative protected field end to end.
- Implement protected create/update/reveal/copy with role checks and audit.
- Build compact persisted list/detail/add flows; do not depend on mock data.

### Phase 2: Vault workflows

- Add item templates, custom protected fields, version history, rotation/expiry, collections, grants, and audit views.
- Add stronger production policies and key-rotation/recovery operations.

### Phase 3: provider-neutral delivery

- Implement the stable delivery contract and adapter conformance tests.
- Add approved Supabase, Cloudflare Workers, runner-environment, and signed-webhook adapters as required.
- Track destination version, rotation, health, retries, and partial failure.

### Phase 4: independent product integrations

- Integrate JOBZCAFE® Gateway without moving canonical JOBZCAFE® routes or policy.
- Integrate Australis Gateway and Hermes runners without moving canonical Australis routes or dispatch policy.
- Verify provider replacement and credential rotation independently.

## 11. Acceptance criteria

1. Planning consistently states that BOH Vault owns values/synchronization, JOBZCAFE® owns its Gateway, and Australis owns its Gateway plus Hermes runner dispatch.
2. BOH Vault is a real tenant-scoped protected-value product, not a metadata-only or inventory-only endpoint.
3. Notes/descriptions are plaintext and only protected fields are encrypted.
4. Browser list/detail queries cannot retrieve ciphertext or decrypted protected values.
5. Protected write/reveal/copy, versioning, rotation, grants, and synchronization are audited.
6. Supabase, Cloudflare, runner environments, signed webhooks, and future adapters fit one provider-neutral contract.
7. No requirement depends on Cloudflare AI Gateway or Cloudflare Tunnel.
8. JOBZCAFE® and Australis can change canonical routes/providers without changing Vault ownership.
9. Australis retains Hermes runner dispatch.
10. Inventory-only records are identified as migration exceptions, not the target product.
11. Production key custody and recovery are approved before production protected values are stored.

## 12. Remaining implementation decisions

1. Which role/claim model governs tenant and cross-tenant access?
2. Which actions require re-authentication, two-person approval, or both?
3. What production root-key custody and recovery mechanism will be approved?
4. Which credential classes use brokered execution, leases, or synchronization first?
5. Which adapter is the first production target, and what rollback contract does it require?
6. What retention and export policy applies to versions and audit events?
7. Which secret-detection warnings should guard plaintext notes without silently converting them into encrypted notes?
