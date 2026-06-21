# BOH Multi-Tenant Foundation - Checkpoint 1

Date: 2026-06-19
Branch: `staging`
Repo: `/home/jobzcafe/jobzcafe-boh`

## Scope

Started the additive database foundation for making BOH a tenant-scoped business-in-a-box suite.

This checkpoint was applied manually to BOH-DEV after review.

BOH-DEV project ref used:

```text
lczzeiqmnegyjrwtgmsj
```

Production BOH was **not** modified.

## Product decisions captured

- BOH tenants choose which suite modules/apps are enabled.
- `JOBZCAFE®` is the first/default tenant.
- `Central` should not remain a BOH Suite app entry; that direction is now Australis.
- `Studio`, `Talent`, `Website` / JOBZCAFE corporate, plus Studio-family apps such as `Coach`, `Mentor`, `Journey`, `DNA`, and possible legacy `Cafe`, are external dashboard-launch apps, not BOH Suite modules.
- There are no hybrid app categories in the tenant model: each app is either `boh` or `external`.
- `Assembly`, `Funnel`, and `Wiki` are BOH Suite modules that are new/not built yet.
- `Loft` currently lives in the JOBZCAFE project, but product-wise belongs in BOH like Slotz; code can move later.
- Front-facing product copy can be `Tablez and Chairz`; backend slug/identifier stays `tablez`.

## Files added

- `supabase/migrations/20260619_add_boh_tenant_foundation.sql`
- `supabase/manual_sql/20260619_verify_boh_tenant_foundation.sql`

## Migration summary

The migration adds:

- `public.boh_tenant`
- `public.boh_tenant_member`
- `public.boh_tenant_app`
- default `jobzcafe` tenant row
- app registry rows for new BOH modules: `assembly`, `funnel`, `wiki`
- tenant app classification using only `boh` and `external`
- `tenant_id` on core BOH identity/access tables:
  - `boh_user`
  - `boh_user_role`
  - `boh_user_app`
- dynamic `tenant_id` backfill for existing operational BOH app tables when those tables exist, including Slotz calendar/OAuth tables and Cellar workspace tables
- `public.current_boh_tenant_id()` helper
- RLS policies for tenant, tenant member, and tenant app reads
- tenant-aware updates to BOH user role/app bootstrap select policies

## BOH-DEV application evidence

Applied to BOH-DEV with:

```bash
supabase link --project-ref lczzeiqmnegyjrwtgmsj
supabase db query --linked --file supabase/migrations/20260619_add_boh_tenant_foundation.sql
```

The first apply attempt failed and rolled back inside the explicit transaction because two `update ... from` statements referenced target aliases inside a `left join`. The migration was fixed to use scalar subqueries for the `boh_user_role` and `boh_user_app` tenant backfill, then re-run successfully.

Verification evidence from BOH-DEV:

```text
boh_tenant:
slug=jobzcafe, name=JOBZCAFE®, status=active, app_context=boh, default_tenant=true

identity/access missing tenant_id counts:
boh_user=0
boh_user_role=0
boh_user_app=0

app kind groups:
boh      = [assembly boh cellar chatz cookbook counter crew forge funnel keep ledger loft menu patron slotz tablez wiki]
external = [coach dna journey mentor studio talent website]

non_boh_or_external_app_kind_count=0

new BOH modules:
assembly -> coming_soon / boh
funnel   -> coming_soon / boh
wiki     -> coming_soon / boh

key app classification:
loft   -> enabled / boh
slotz  -> enabled / boh
coach  -> enabled / external
dna    -> enabled / external
journey-> enabled / external
mentor -> enabled / external
studio -> enabled / external
talent -> enabled / external
website-> enabled / external
```

Operational tenant columns verified as `tenant_id` nullable `NO` on the original core spot-check set:

```text
boh_initiative
boh_task
boh_user_story
boh_workstream
content_projects
counter_ticket
counter_ticket_comment
keep_file
patron_activity
patron_organisation
patron_person
tablez_project
tablez_task
```

Follow-up BOH app audit was run after clarifying that Central/Australis tables can wait but BOH apps must be tenant-managed now. The migration was expanded and re-applied to BOH-DEV to include additional BOH app tables, including:

```text
Slotz/scheduling: scheduling_*, google_oauth_tokens, outlook_oauth_tokens, google_calendar_sync, outlook_calendar_sync, outlook_synced_events
Cellar: cellar_*
Patron lookup/join/custom-field tables
Tablez Chairz/task lookup/join tables
Keep activity/folder/version/approval tables
Counter lookup tables
Forge walkthrough tables
Chatz conversation/message tables
BOH workstream/initiative/story status/event/approval tables
AI knowledge/persona pack tables used by BOH
```

Post-expansion audit returned no remaining non-Central/non-deprecated BOH app tables without `tenant_id`, excluding only registry/deprecated tables:

```text
[]
```

Intentional exclusions from this checkpoint:

```text
central_*     -> deferred to Australis build/migration
boh_secret    -> deprecated; remove after scheduling triggers stop reading it
boh_app       -> global app registry; per-tenant enablement lives in boh_tenant_app
boh_app_module-> global app/module registry
boh_role      -> global role registry; per-user/tenant grants live in boh_user_role
boh_tenant    -> tenant root table
```

## Verification run locally

Static migration checks passed:

- migration has begin/commit
- creates tenant/member/app tables
- seeds JOBZCAFE tenant
- excludes Central from tenant app enablement
- includes Assembly/Funnel/Wiki
- creates `current_boh_tenant_id()`
- avoids the earlier table-name shadowing issue in the dynamic tenant table loop

`npm ci --ignore-scripts` completed successfully.

`npm run typecheck` did **not** pass, but failures are unrelated to this SQL-only checkpoint and come from existing TypeScript issues in archived/current app files, including missing archived imports and existing `category` typing errors in `src/boh/navigation/appConfigs.ts`.

## Production/deployment notes

- BOH-DEV was updated manually through the reviewed SQL migration file.
- Production BOH was **not** changed.
- No secrets, Edge Functions, runtime files, or frontend deploys were changed.
- The SQL file is the production-promotion artifact to review later: `supabase/migrations/20260619_add_boh_tenant_foundation.sql`.
- Before production promotion, compare BOH production schema shape against BOH-DEV because the migration dynamically adds tenant columns only to tables that exist.
- The migration uses an explicit transaction and is idempotent for re-runs, but production review should still assess table-lock/backfill risk because it updates and sets `tenant_id not null` on multiple existing operational tables.
- After production promotion, run `supabase/manual_sql/20260619_verify_boh_tenant_foundation.sql` against production and append the production evidence to this file.

## Next checkpoint recommendation

After this foundation is reviewed/applied to BOH-DEV, update frontend access loading to read tenant-aware app enablement from `boh_tenant_app` instead of only `boh_app` / `boh_user_app`.
