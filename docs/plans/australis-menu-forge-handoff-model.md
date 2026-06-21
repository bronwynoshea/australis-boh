# Australis Menu / Forge / Counter deliverables model

This note documents the BOH-DEV operating model for tracking Australis build work without mixing Australis product data into BOH.

## Boundary

- JOBZCAFE® BOH records are the operating and planning layer.
- Australis product records remain in the Australis repo and `australis-dev` Supabase project.
- The Australis tenant/workspace in BOH is for planning, delivery coordination, and support intake only.

## Ownership chain

1. Menu Initiative
   - Table: `public.boh_initiative`.
   - Ownership: Menu owns initiative creation, readiness, planning metadata, product deliverables, intake, and the source planning record.
   - App semantics: `app_id` should point at the Menu app for an initiative that represents a planning deliverable, even when the delivered product is Australis.
   - Handoff field: `forge_status_id` is not ownership. It is a Menu-to-Forge handoff/review status.

2. Forge Handoff / Status
   - Table: `public.boh_initiative_forge_status` via `boh_initiative.forge_status_id`.
   - Meaning: draft/ready/submitted/accepted/deferred style state that tells Forge whether an initiative is ready for execution planning.
   - UI language should say Menu-to-Forge handoff or Forge handoff status, not imply the initiative lives under Forge.

3. Forge Workstream
   - Table: `public.boh_workstream`.
   - Ownership: Forge owns workstreams after a Menu initiative has been submitted/accepted for execution.
   - Workstreams reference the Menu initiative by `initiative_id`; they do not replace or own the initiative.

4. Counter Tickets / Tasks
   - Tables: `public.counter_ticket` and task/story execution tables where applicable.
   - Ownership: Counter owns support/bug/blocker intake. Tickets/tasks should reference the Australis tenant/workspace when they are about Australis build work.

## Australis example

- Tenant/workspace: `boh_tenant.slug = 'australis'`.
- Menu initiative: `Build standalone Australis platform` in `boh_initiative` with `app_id = menu_app_id` and `tenant_id = australis_tenant_id`.
- Forge handoff: `forge_status_id` records whether that Menu initiative has been submitted/accepted/deferred for Forge execution.
- Forge execution: `boh_workstream` rows such as `Australis local foundation and repo verification` reference the Menu initiative by `initiative_id` and carry `tenant_id = australis_tenant_id`.
- Counter intake: `Australis build blocker and bug intake` gives build blockers a separate Australis-scoped Counter entry.

## Acceptance criteria for future agents

- New Australis planning deliverables are created as Menu initiatives, not Forge-owned initiatives.
- Forge pages may read submitted/accepted Menu initiatives and create workstreams, but must not expose initiative CRUD as Forge-owned CRUD.
- UI copy uses `Menu-to-Forge Handoff`, `Submitted to Forge`, or `Accepted by Forge`; avoid broad `Forge Pipeline` labels on Menu-owned initiative screens.
- `app_id` for the Australis initiative stays Menu unless the record is not an initiative planning record.
- `forge_status_id` is documented and treated as a handoff status, not app ownership.
- `boh_release_version` rows are delivery/release planning records scoped to BOH; release wording should not imply Australis product data lives in BOH.
- Production Supabase is not touched without explicit approval.
