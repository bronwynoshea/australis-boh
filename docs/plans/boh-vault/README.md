# BOH Vault Planning Index

Status: reconciled with the final product-owned Gateway and provider-neutral Vault architecture
Updated: 2026-07-14

## Architecture in one line

```text
BOH Vault owns protected values, references, rotation, audit, and synchronization; JOBZCAFE® owns its Gateway, while Australis owns its Gateway and Hermes runner dispatch.
```

BOH Vault does not own canonical product routes. Notes and descriptions are plaintext; only protected fields are encrypted. Supabase, Cloudflare, runner environments, signed webhooks, and future adapters are deployment/synchronization targets rather than hard dependencies. Cloudflare AI Gateway and Cloudflare Tunnel are not required.

## Documents

- [Product boundary](product-boundary.md) — final ownership and integration decision.
- [Implementation plan](implementation-plan.md) — secure vertical slice, Vault workflows, provider-neutral adapters, and product Gateway integration.
- [PRD](../boh-vault-and-australis-gateway-prd.md) — product requirements and acceptance criteria.
- [Conversation summary](conversation-summary.md) — historical context only; superseded by the documents above.

## Implementation handoff

1. Use the PRD and product boundary as the architecture source of truth.
2. Start with a persisted, tenant-scoped secure vertical slice rather than mock data or a metadata-only endpoint.
3. Encrypt protected fields only; keep ordinary notes/descriptions as safe plaintext metadata.
4. Add brokered, leased, or synchronized delivery through provider-neutral adapters.
5. Integrate independently with the JOBZCAFE® Gateway and the Australis Gateway/Hermes runner path without moving canonical routes into Vault.
6. Review production key custody, recovery, tenant isolation, authorization, and adapter security before storing production values.

Database migrations, manual SQL, and runtime implementation are intentionally outside this documentation-only reconciliation.
