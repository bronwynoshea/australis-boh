# Product Boundary: BOH Vault and Product-Owned Gateways

Status: final architecture decision

## Decision

**BOH owns Vault secret values and synchronization. Each product owns its canonical Gateway routes and runtime policy.**

- **BOH Vault** is the tenant-scoped source of truth for protected values, versions, access, rotation, audit, credential references, and synchronization state.
- **JOBZCAFE®** owns its Gateway, canonical route keys, provider/model policy, fallbacks, credits, allowances, and product behavior.
- **Australis** owns its Gateway, canonical route keys, runtime execution, and Hermes runner dispatch.

BOH Vault may supply credentials and health to both Gateways, but it is not the route catalogue, fallback-policy owner, or product AI control plane.

## BOH Vault owns

- Passwords, API/service keys, private keys, signing secrets, recovery codes, certificates, and protected custom fields.
- Plaintext metadata including titles, descriptions, ordinary notes, tags, owners, environments, and usage guidance.
- Per-field protection: only protected fields are encrypted; notes are not required to be “secure notes.”
- Tenant and environment isolation.
- Secret versioning, expiry, rotation, reveal/copy controls, and audit history.
- Stable non-secret references used by approved consumers.
- Brokered execution, short-lived leases, and managed synchronization.
- Destination/adaptor status for Supabase, Cloudflare, runner environments, signed webhooks, and future integrations.
- Root/key versioning and recovery planning.

## BOH Vault does not own

- Canonical JOBZCAFE® or Australis route definitions.
- Provider/model selection, fallback order, budgets, credits, allowances, or user-facing AI behavior.
- Australis Work Session behavior or Hermes runner dispatch policy.
- JOBZCAFE® product policy.
- A mandatory Cloudflare AI Gateway or Cloudflare Tunnel deployment.

## JOBZCAFE® owns its Gateway

JOBZCAFE® owns:

- Gateway endpoints and canonical route keys;
- provider/model adapters and routing policy;
- ordered fallbacks and health behavior;
- credits, allowances, task policy, and user-facing behavior;
- references to approved BOH Vault credentials.

Changing a JOBZCAFE® route must not require moving that route into BOH Vault.

## Australis owns its Gateway and runner dispatch

Australis owns:

- Gateway endpoints and canonical route keys;
- provider/model adapters and routing policy;
- ordered fallbacks and runtime health behavior;
- Work Session and platform AI execution;
- Hermes runner selection and dispatch;
- references to approved BOH Vault credentials.

Changing an Australis route or runner policy must not require moving it into BOH Vault.

## Provider-neutral integration

```text
BOH Vault
  protects values, versions, access, rotation, references, and sync state
       |
       +-- brokered use / short-lived lease / managed synchronization
       |
       +--> JOBZCAFE® Gateway (JOBZCAFE® routes and policy)
       +--> Australis Gateway (Australis routes and policy)
       +--> Hermes runners (Australis dispatch)
       +--> Supabase, Cloudflare, signed webhooks, and future adapters
```

Supabase and Cloudflare are valid deployment targets, not architectural owners. Cloudflare AI Gateway and Cloudflare Tunnel are optional infrastructure choices and are not requirements.

## UI implications

### BOH Vault

Provide a compact password-manager-style surface for item metadata, protected fields, reveal/copy, versions, rotation, access, audit, and synchronization status.

Descriptions and ordinary notes are plaintext and searchable. A user may explicitly mark a custom field protected, but the product does not force notes into an encrypted “secure note” workflow.

### Product Gateway surfaces

JOBZCAFE® and Australis Gateway screens manage their own routes and policy. They may show:

- linked Vault reference;
- credential readiness and version;
- synchronization/destination health;
- request/setup/rotate actions that cross into BOH Vault.

They do not become password managers and do not reveal raw secret values in normal route-management flows.
