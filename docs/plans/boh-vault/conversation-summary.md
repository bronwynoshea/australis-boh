# BOH Vault Conversation Summary (Historical)

> **Historical / superseded — do not use as an implementation source of truth.**
>
> This document records the earlier discussion that led to the BOH Vault concept. Its metadata-first, mock-first, secure-note, and Australis-only Gateway assumptions were superseded on 2026-07-14. Use the [planning index](README.md), [product boundary](product-boundary.md), [implementation plan](implementation-plan.md), and [PRD](../boh-vault-and-australis-gateway-prd.md).

## Historical context

The discussion began while reviewing an Australis Credentials screen. It established several useful product needs:

- a compact password-manager-style Vault rather than oversized cards;
- one governed place for development and production credentials;
- authorized, audited reveal/copy/rotation workflows;
- tenant isolation and root-key rotation/recovery planning;
- product Gateway screens that reference Vault credentials without becoming password managers.

## Decisions that remain valid

1. Full secret-management capability belongs in BOH Vault.
2. BOH Vault is tenant scoped and must protect secret values behind an audited backend boundary.
3. Development and production credentials can live in one governed Vault with clear separation.
4. Product UIs should use stable Vault references and avoid raw reveal/copy in normal Gateway workflows.
5. BOH Menu may track the initiative and Forge may track implementation workstreams.

## Superseding corrections

The current architecture adds or corrects the following:

- BOH Vault owns secret values, versions, rotation, references, and synchronization, not canonical AI routes.
- JOBZCAFE® owns its Gateway routes and product AI policy.
- Australis owns its Gateway routes/runtime and Hermes runner dispatch.
- Notes and descriptions are plaintext; only protected fields are encrypted. A secure-note item is not required.
- The implementation begins with a persisted secure vertical slice, not mock data followed by a metadata-only Vault.
- Provider-neutral delivery supports Supabase, Cloudflare, runner environments, signed webhooks, and future adapters.
- Cloudflare AI Gateway and Cloudflare Tunnel are not architectural requirements.
- Inventory-only records are migration exceptions, not the intended Vault product.

## Historical artifacts

The earlier BOH Menu seed remains a separate, unexecuted BOH-DEV planning artifact. It is not part of this documentation reconciliation and may contain older wording; review it against the current PRD before any future use.
