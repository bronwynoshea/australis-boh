# BOH table → application/module ownership review

Generated: 2026-06-21T04:22:44.038752Z against linked BOH-DEV project (`/home/jobzcafe/jobzcafe-boh`).

## Product convention

- Application/module names do **not** always match table prefixes. This is acceptable if ownership and tenant boundaries are documented.
- Accepted mappings: `scheduling_*` = **Slotz**, `boh_initiative*` = **Menu initiatives / Menu→Forge handoff**, `boh_workstream` + release tables = **Forge execution**, `patron_*` = **Patron**, `counter_*` = **Counter**.
- Do not rename table families now unless a dedicated migration/refactor is approved; prioritize `tenant_id`, RLS, triggers/functions, and documentation.
- Some BOH apps are intentionally registered as `external_app` because JOBZCAFE® users can access them directly outside the BOH shell. They are **not** intended to be sold separately now; they are sold as part of BOH. Do not convert those rows to `internal_tool` solely because they are BOH-bundled.
- Keep the `central` app/table family in place for now as legacy/reference data until we know what should move across to Australis.

## BOH app registry

| slug | name | context | type | active | route |
|---|---|---|---|---|---|
| assembly | Assembly | boh | internal_tool | true | /assembly |
| boh | BOH | boh | internal_tool | true | /boh |
| cafe | Cafe | cafe | external_app | false | /apps/cafe |
| cellar | Cellar | boh | internal_tool | true | /cellar |
| central | Central | boh | internal_tool | true |  |
| chatz | Chatz | chatz | external_app | true | /apps/chatz |
| coach | Coach | coach | external_app | true | /apps/coach |
| cookbook | Cookbook | boh | internal_tool | true | /cookbook |
| counter | Counter | boh | internal_tool | true | /counter |
| crew | Crew | boh | internal_tool | true | /crew |
| dna | DNA | dna | external_app | true | /apps/dna |
| forge | Forge | boh | internal_tool | true | /forge |
| funnel | Funnel | boh | internal_tool | true | /funnel |
| journey | Journey | journey | external_app | true | /apps/journey |
| keep | Keep | boh | internal_tool | true | /keep |
| ledger | Ledger | boh | internal_tool | true | /ledger |
| loft | Loft | boh | external_app | true |  |
| mentor | Mentor | mentor | external_app | true | /apps/mentor |
| menu | Menu | boh | internal_tool | true | /menu |
| patron | Patron | boh | internal_tool | true | /patron |
| slotz | Slotz | boh | external_app | true | /apps/slotz |
| studio | Studio | boh | external_app | true |  |
| tablez | Tablez and Chairz | boh | internal_tool | true | /tablez |
| talent | Talent | boh | external_app | true | /talent |
| website | Website | cafe | external_app | true | /website |
| wiki | Wiki | boh | internal_tool | true | /wiki |

## Summary by inferred module

| module/owner | table count |
|---|---:|
| Agent/AI library | 6 |
| BOH app registry | 1 |
| BOH app registry/module lookup | 1 |
| BOH identity/access core | 4 |
| BOH identity/access lookup | 1 |
| BOH secret registry (needs tenant-scope decision) | 1 |
| BOH shared governance | 1 |
| BOH tenant app enablement | 1 |
| BOH tenant membership | 1 |
| BOH tenant registry | 1 |
| Cellar | 17 |
| Chatz/BOH shared conversation | 3 |
| Counter | 5 |
| Forge | 3 |
| Forge execution workstreams | 1 |
| Forge workstream approvals | 1 |
| Forge/Menu release planning | 1 |
| Forge/Menu task execution | 2 |
| Funnel/campaigns | 2 |
| Keep | 10 |
| Menu (canonical initiative table) | 1 |
| Menu lookup | 2 |
| Menu/Forge planning calendar | 1 |
| Menu/Forge user stories | 1 |
| Menu/Forge user story audit | 1 |
| Menu→Forge handoff lookup | 1 |
| Menu↔Forge release link | 1 |
| Patron | 16 |
| Slotz | 8 |
| Slotz calendar integration | 5 |
| Tablez | 12 |
| Unclassified / needs owner decision | 30 |
| Website/Studio content support | 5 |

## High-priority tenant-scope gaps

No obvious operational BOH app table is missing `tenant_id` under the current heuristic.

## Tables needing owner or design decision

Decision update: `central_*` remains in BOH for now as legacy/reference data while we determine what needs to move across to Australis. Treat those rows as migration-assessment items, not immediate tenant-scope fixes. `external_app` entries can remain external when the app is also available directly to JOBZCAFE® users outside the BOH shell, but current commercial packaging is BOH as a bundle rather than individual external app sales.

| table | inferred owner | tenant_id | app_context | FK clues | note |
|---|---|---:|---:|---|---|
| `boh_secret` | BOH secret registry (needs tenant-scope decision) | False | True |  | needs decision: likely add tenant_id/app_id for multi-tenant secret ownership |
| `boh_workstream_status` | Unclassified / needs owner decision | True | False | tenant_id→boh_tenant | lookup/registry; tenant_id usually optional |
| `central_agent_actions` | Unclassified / needs owner decision | False | False | agent_id→central_agents, reviewed_by→central_agents | needs module owner + tenant-scope decision |
| `central_agent_budgets` | Unclassified / needs owner decision | False | False | agent_id→central_agents, parent_agent_id→central_agents | needs module owner + tenant-scope decision |
| `central_agent_capability_bindings` | Unclassified / needs owner decision | False | False | agent_runtime_id→central_agents, capability_id→central_capabilities, created_by→boh_user, updated_by→boh_user | needs module owner + tenant-scope decision |
| `central_agent_conversations` | Unclassified / needs owner decision | False | False | from_agent_id→central_agents, task_id→central_task, to_agent_id→central_agents | needs module owner + tenant-scope decision |
| `central_agent_creation_requests` | Unclassified / needs owner decision | False | False | created_agent_id→central_agents, persona_template_id→central_agent_persona_templates, requester_agent_id→central_agents, resolved_by→central_agents, section→central_sections | needs module owner + tenant-scope decision |
| `central_agent_model_route` | Unclassified / needs owner decision | False | False | agent_id→central_agents, model_key→central_models | needs module owner + tenant-scope decision |
| `central_agent_persona_templates` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_agent_profile_documents` | Unclassified / needs owner decision | False | False | agent_runtime_id→central_agents, created_by→boh_user, updated_by→boh_user | needs module owner + tenant-scope decision |
| `central_agents` | Unclassified / needs owner decision | False | False | approved_by→boh_user, created_by→boh_user, model_key→central_models, parent_runtime_id→central_agents, persona_template_id→central_agent_persona_templates, section→tablez_section, vps_deployed_by→boh_user | needs module owner + tenant-scope decision |
| `central_capabilities` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_credential_audit_events` | Unclassified / needs owner decision | False | False | credential_id→central_credentials | needs module owner + tenant-scope decision |
| `central_credentials` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_lessons_category` | Unclassified / needs owner decision | False | False |  | lookup/registry; tenant_id usually optional |
| `central_lessons_learned` | Unclassified / needs owner decision | False | True | agent_runtime_id→central_agents, app_id→boh_app, category_code→central_lessons_category, created_by→boh_user, initiative_id→boh_initiative, module_id→boh_app_module, section_id→central_sections, severity_code→central_lessons_severity, source_type_code→central_lessons_source_type, task_id→central_task, updated_by→boh_user, verified_by→boh_user | needs module owner + tenant-scope decision |
| `central_lessons_prevention_step` | Unclassified / needs owner decision | False | False | lesson_id→central_lessons_learned | needs module owner + tenant-scope decision |
| `central_lessons_related` | Unclassified / needs owner decision | False | False | lesson_id→central_lessons_learned, related_lesson_id→central_lessons_learned | needs module owner + tenant-scope decision |
| `central_lessons_severity` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_lessons_source_type` | Unclassified / needs owner decision | False | False |  | lookup/registry; tenant_id usually optional |
| `central_lessons_tag` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_lessons_tag_map` | Unclassified / needs owner decision | False | False | lesson_id→central_lessons_learned, tag_id→central_lessons_tag | needs module owner + tenant-scope decision |
| `central_models` | Unclassified / needs owner decision | False | False | created_by→boh_user | needs module owner + tenant-scope decision |
| `central_sections` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |
| `central_tables` | Unclassified / needs owner decision | False | False | section_id→central_sections | needs module owner + tenant-scope decision |
| `central_task` | Unclassified / needs owner decision | False | False | app_id→boh_app, assigned_agent_runtime_id→central_agents, assigned_user_id→boh_user, initiative_id→boh_initiative, module_id→boh_app_module, qa_agent_runtime_id→central_agents, requested_by→boh_user, source_story_id→boh_user_story | needs module owner + tenant-scope decision |
| `central_task_delivery_event` | Unclassified / needs owner decision | False | False | actor_agent_runtime_id→central_agents, actor_user_id→boh_user, task_id→central_task | needs module owner + tenant-scope decision |
| `central_task_dependency` | Unclassified / needs owner decision | False | False | created_by→boh_user, depends_on_task_id→central_task, task_id→central_task | needs module owner + tenant-scope decision |
| `central_task_run` | Unclassified / needs owner decision | False | False | agent_runtime_id→central_agents, model_key→central_models, task_id→central_task | needs module owner + tenant-scope decision |
| `central_token_usage` | Unclassified / needs owner decision | False | False | model_key→central_models | needs module owner + tenant-scope decision |
| `central_vps_sync_statuses` | Unclassified / needs owner decision | False | False |  | needs module owner + tenant-scope decision |

## Slotz / scheduling note

All discovered `scheduling_*`, Google calendar, and Outlook calendar integration tables have `tenant_id`. The app name can remain **Slotz** while backend tables remain `scheduling_*`. The trigger bug seen during admin bootstrap is not a table-family naming issue; it is a trigger implementation issue where `sync_boh_avatar_to_staff_profile()` inserts into `scheduling_staff_profiles` without `tenant_id`.

## App-origin field review

Reviewed BOH-DEV app-origin fields on 2026-06-21: `app_context`, `external_app_context`, `app`, `apps`, `app_kind`, `app_key`, `app_id`, `module_id`, and source/origin-like fields.

### Current JOBZCAFE® app model

- **BOH** is the commercial bundle/package for company operations.
- **Studio** is the job-seeker app group/shell. It contains the job-seeker modules/apps: **Cafe**, **Journey**, **Coach**, **Mentor**, and later **DNA**.
- **Cafe** is one module inside Studio and has its own sub-modules/features accessible from `jobzcafe-app` / `jobzcafe-dev`.
- **Talent** is the recruiter-side equivalent of Cafe: recruiter workspace/app family, not ATS.
- **Slotz**, **Loft**, and likely **Chatz** are shared cross-audience capabilities used by both recruiters and job seekers as well as BOH/company users.
- **All other apps** are now part of BOH, even if some need direct access by JOBZCAFE® users outside the BOH shell.
- **Loft** and **Slotz** are BOH-bundled capabilities that still need direct JOBZCAFE® user access.
- **Patron** is the shared person/CRM source. Marketing creates/updates Patron records first where possible; Studio/Talent account creation should check Patron to avoid duplicate people. Counter tickets should link to existing Patron people when users already exist as prospects/job seekers/recruiters rather than BOH users.
- **JOBZCAFE® core should not depend on BOH/Australis as its product data source of truth.** If BOH or Australis spin off, Studio/Talent still need their own accounts, messaging, recruiter/job-seeker data, and integration surface.
- **Talent integrations should be future-ready.** Early integrations may target BOH apps such as Slotz, Loft, Counter, Patron, and Chatz, but the table model should also support later external systems such as Zoom, Slack, Teams, Google/Microsoft Calendar, and ATS platforms without reshaping core Talent tables.

### Future integration boundary

Use an integration-hub pattern in the JOBZCAFE®/Talent data model rather than baking BOH-specific columns into core Talent tables.

| concept | purpose | notes |
|---|---|---|
| `integration_provider` | catalog of available providers (`boh`, `slotz`, `loft`, `zoom`, `slack`, `greenhouse`, `lever`, etc.) | provider metadata only; no customer secrets |
| `integration_connection` | tenant/customer/recruiter workspace connection to a provider | owns auth status, scopes, environment, connected account/team/workspace IDs |
| `integration_credential` or vault reference | token/secret reference | store secrets in vault/encrypted table, not directly on business records |
| `integration_external_identity` | maps local people/users/orgs/jobs/interviews to external IDs | supports one local entity linking to many systems |
| `integration_sync_state` | cursors, webhooks, last sync status | keeps retries and sync metadata out of core app tables |
| `integration_event` | audit/event log from providers | useful for debugging webhooks and handoffs |
| `integration_capability` | flags what a connection can do (`calendar`, `messaging`, `ats_import`, `video_meeting`, `ticket_escalation`) | lets UI enable workflows without provider-specific branching everywhere |

Early BOH integrations should be represented as provider connections too, for example:

- `provider = boh_counter` for support/escalation tickets
- `provider = boh_patron` for CRM/person sync
- `provider = boh_slotz` for scheduling/interviews
- `provider = boh_loft` for workspaces/rooms
- `provider = boh_chatz` only for BOH-side/internal messaging bridges

Later external providers can use the same shape:

- `zoom` / `teams` / `google_meet` for meetings
- `slack` / `teams_chat` for messaging notifications
- `greenhouse` / `lever` / `ashby` / other ATS for recruiter workflows

Do not put provider-specific fields directly on core records such as candidate, recruiter, interview, or message unless they are cached display fields. Use identity/link tables instead.

### Recommended semantics

| field | intended meaning | recommendation |
|---|---|---|
| `tenant_id` | company/customer data boundary | keep as the primary isolation field |
| `app_id` | canonical owning app/module row in `boh_app` | prefer this for app ownership when present; Studio can identify the job-seeker app group, while feature ownership should resolve to Cafe/Journey/Coach/Mentor/DNA where applicable |
| `module_id` | sub-module/feature inside an app via `boh_app_module` | use for Cafe/Talent sub-modules and BOH app features where routing/reporting needs it |
| `app_context` | runtime/surface namespace or legacy app context | stop using it as the primary app owner when `app_id` exists; values should align to known app/surface contexts or documented legacy contexts |
| `app` | legacy/free-text app slug, mostly on `counter_ticket` | backfill/derive from `app_id` where possible; do not add new tables with this pattern |
| `apps` | invite/access list of app slugs | replace long-term with normalized rows (`boh_user_app` / `boh_tenant_app`) |
| `app_kind` | tenant-app packaging/classification | clarify as BOH-bundled vs direct-access surface, not sold-separately |
| `source` / `source_type*` | acquisition/event origin | keep separate from app ownership; examples include `manual`, `codex`, `sadie`, `jobzcafe_login`, `slotz_booking`, `talent_demo_request`, `recruiter_intake` |

### Messy/inconsistent areas found

| area | evidence from BOH-DEV | proposed cleanup |
|---|---|---|
| `counter_ticket` has three app-origin columns | `app`, `app_context`, and `app_id`; 322 tickets; 315 have `app_id`; 7 are missing `app_id` (`career_studio` x3, `corporate`, `jobzcafe`, `delivery`, `Australis`) | make `app_id` canonical; map/merge unknown legacy slugs or park them in a documented legacy bucket; keep `app` only as derived/legacy display if required |
| `counter_ticket.app_context` is sometimes app-specific and sometimes `boh` | tickets with `app_id` have no `app_context` mismatch against `boh_app.app_context`, but many product apps intentionally have registry context `boh` | document that `app_context='boh'` means BOH bundle/runtime context, not the owning app; ownership is `app_id` |
| `counter_ticket_comment.app_context` is not constrained to ticket owner | comments mix `counter`, ticket app contexts, and legacy contexts (`talent`, `cellar`, `loft`, `forge`, `slotz`, `boh`, etc.) | decide whether comment context means comment author/source surface; if yes rename/document as `source_context`; if no, derive from parent ticket and stop writing independent values |
| `boh_tenant_app.app_kind` duplicates/overlaps `boh_app.type` | examples: `slotz` type=`external_app` but `app_kind='boh'`; `studio/talent/website/coach/dna/journey/mentor` often `app_kind='external'`; `chatz` is type=`external_app` but tenant kind `boh` | define `boh_app.type` as UI/surface classification and `boh_tenant_app.app_kind` as tenant packaging/access classification, or collapse one later |
| `boh_invite.apps` is free-text array | rows include one `{counter}` and four long arrays containing many slugs including legacy `central-co...` value | normalize invite app grants to app ids or validate array values against `boh_app.slug` |
| `app_context` type is inconsistent | most columns are `text`; only `boh_secret` and `scheduling_staff_profiles` use `app_context_enum`; enum lacks several current slugs (`slotz`, `forge`, `studio`, `loft`, etc.) | avoid expanding enum piecemeal; either migrate to FK-based ownership or centralize allowed context values |
| `scheduling_staff_profiles.app_context` defaults to `cafe` | all current rows are `cafe`, while product/app owner is Slotz and table family is `scheduling_*` | treat as legacy/source surface only, not Slotz ownership; consider future rename to `source_app_context` or replace with `app_id` if used |
| `patron_person.external_app_context` defaults to `cafe` | values: `cafe` x17, `boh` x7 while `app_context` is `patron`; `source` holds actual origin such as `jobzcafe_login`, `slotz_booking`, `recruiter_intake` | keep `app_context='patron'` as owner; clarify `external_app_context` as acquisition/access surface (`cafe`, `talent`, `boh`, etc.) or fold into `source`/metadata |
| Studio/Talent Patron sync is partially implemented but inconsistent | `talent-app/supabase/functions/talent-demo-request` calls BOH `boh-patron-upsert`, which upserts `patron_person` by email and links organisation; `jobzcafe-app/src/lib/patronSync.ts` calls BOH `patron-sync`, but the BOH `patron-sync` function still references old table `patron` while BOH-DEV only has `patron_person` | keep `boh-patron-upsert` as the modern pattern; update/replace `patron-sync` so Studio account creation upserts/checks `patron_person` by normalized email and records `external_user_id`/`external_app_context='cafe'` |
| Patron duplicate prevention is code-level, not DB-enforced by email | BOH-DEV `patron_person` has unique `boh_user_id` but no unique lower-email constraint; current upsert functions lookup by email before insert | before hardening account flows, add a safe normalized-email uniqueness strategy per tenant or add a dedicated identity-link table if one person can legitimately have multiple emails |
| Counter can create Patron records for ticket requesters | `sadie-create-ticket` resolves `patron_person` by `boh_user_id`, then by email, then creates a minimal record with `source='counter_ticket'` | keep this as the fallback so non-BOH users can still create Counter tickets, but align it with Studio/Talent Patron sync semantics |
| `central_*` uses multiple legacy app-origin patterns | `assigned_app`, `app_key`, `source_system`, `app_id`, `module_id`, `app_context`; mostly legacy/empty now | leave in place for migration assessment to Australis; do not normalize until migration target is known |

### Current cleanup priority

1. Do not rename table families.
2. Do not treat `external_app` as separate-sale packaging; current sale/package is BOH as a bundle.
3. Make `app_id` the canonical app owner in operational tables that already have it.
4. Treat `app_context` as legacy/runtime/surface context unless a table has no `app_id`.
5. Fix the seven `counter_ticket` rows without `app_id` only after deciding mappings for `career_studio`, `corporate`, `delivery`, `jobzcafe`, and `Australis`.
6. Fix Studio/JOBZCAFE® Patron sync before relying on it for duplicate prevention: `jobzcafe-app` currently calls BOH `patron-sync`, but BOH `patron-sync` targets old `public.patron`; modern flows should upsert `public.patron_person` like `boh-patron-upsert` does for Talent.
7. Normalize or validate free-text/array app-origin fields in a later migration (`counter_ticket.app`, `boh_invite.apps`, `counter_ticket_comment.app_context`, `patron_person.external_app_context`).

## Full table mapping

| table | inferred app/module | tenant_id | app_context | app_id | RLS | note |
|---|---|---:|---:|---:|---:|---|
| `ai_knowledge_items` | Agent/AI library | True | False | False | true | review if used by BOH tenant data |
| `ai_knowledge_packs` | Agent/AI library | True | True | False | true | review if used by BOH tenant data |
| `ai_persona_knowledge_packs` | Agent/AI library | True | False | False | true | review if used by BOH tenant data |
| `ai_personas` | Agent/AI library | True | True | False | true | review if used by BOH tenant data |
| `boh_app` | BOH app registry | False | True | False | true | lookup/registry; tenant_id usually optional |
| `boh_app_module` | BOH app registry/module lookup | False | False | True | true | lookup/registry; tenant_id usually optional |
| `boh_campaign_banner` | Funnel/campaigns | True | False | False | true | tenant-scoped column present |
| `boh_campaign_bonus_tier` | Funnel/campaigns | True | False | False | true | tenant-scoped column present |
| `boh_change_request` | BOH shared governance | True | False | False | true | tenant-scoped column present |
| `boh_conversation` | Chatz/BOH shared conversation | True | True | False | true | tenant-scoped column present |
| `boh_conversation_member` | Chatz/BOH shared conversation | True | True | False | true | tenant-scoped column present |
| `boh_initiative` | Menu (canonical initiative table) | True | False | True | true | tenant-scoped column present |
| `boh_initiative_forge_status` | Menu→Forge handoff lookup | True | False | False | true | lookup/registry; tenant_id usually optional |
| `boh_initiative_planning_stage` | Menu lookup | True | False | False | true | lookup/registry; tenant_id usually optional |
| `boh_initiative_release` | Menu↔Forge release link | True | False | False | true | tenant-scoped column present |
| `boh_initiative_status` | Menu lookup | True | False | False | true | lookup/registry; tenant_id usually optional |
| `boh_invite` | BOH identity/access core | True | True | False | true | tenant-scoped column present |
| `boh_message` | Chatz/BOH shared conversation | True | True | False | true | tenant-scoped column present |
| `boh_quarter_calendar` | Menu/Forge planning calendar | True | False | False | true | tenant-scoped column present |
| `boh_release_version` | Forge/Menu release planning | True | False | False | true | tenant-scoped column present |
| `boh_role` | BOH identity/access lookup | False | True | False | true | lookup/registry; tenant_id usually optional |
| `boh_secret` | BOH secret registry (needs tenant-scope decision) | False | True | False | true | needs decision: likely add tenant_id/app_id for multi-tenant secret ownership |
| `boh_task` | Forge/Menu task execution | True | False | False | true | tenant-scoped column present |
| `boh_task_comment` | Forge/Menu task execution | True | False | False | true | tenant-scoped column present |
| `boh_tenant` | BOH tenant registry | False | True | False | true | lookup/registry; tenant_id usually optional |
| `boh_tenant_app` | BOH tenant app enablement | True | False | True | true | tenant-scoped column present |
| `boh_tenant_member` | BOH tenant membership | True | False | False | true | tenant-scoped column present |
| `boh_user` | BOH identity/access core | True | True | False | true | tenant-scoped column present |
| `boh_user_app` | BOH identity/access core | True | True | True | true | tenant-scoped column present |
| `boh_user_role` | BOH identity/access core | True | True | False | true | tenant-scoped column present |
| `boh_user_story` | Menu/Forge user stories | True | False | False | true | tenant-scoped column present |
| `boh_user_story_event` | Menu/Forge user story audit | True | False | False | true | tenant-scoped column present |
| `boh_workstream` | Forge execution workstreams | True | False | False | true | tenant-scoped column present |
| `boh_workstream_approval` | Forge workstream approvals | True | False | False | true | tenant-scoped column present |
| `boh_workstream_status` | Unclassified / needs owner decision | True | False | False | true | lookup/registry; tenant_id usually optional |
| `cellar_activity_events` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_asset_access_requests` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_assets` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_booking_link_audits` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_guest_access_codes` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_investor_access` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_investor_notes` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_investor_profiles` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_investor_questions` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_investor_sessions` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_message_threads` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_messages` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_prepared_qa` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_presentations` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_staff_contact_notes` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_staff_visibility_permissions` | Cellar | True | False | False | true | tenant-scoped column present |
| `cellar_team_members` | Cellar | True | False | False | true | tenant-scoped column present |
| `central_agent_actions` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_budgets` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_capability_bindings` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_conversations` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_creation_requests` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_model_route` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_persona_templates` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agent_profile_documents` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_agents` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_capabilities` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_credential_audit_events` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_credentials` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_lessons_category` | Unclassified / needs owner decision | False | False | False | true | lookup/registry; tenant_id usually optional |
| `central_lessons_learned` | Unclassified / needs owner decision | False | True | True | true | needs module owner + tenant-scope decision |
| `central_lessons_prevention_step` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_lessons_related` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_lessons_severity` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_lessons_source_type` | Unclassified / needs owner decision | False | False | False | true | lookup/registry; tenant_id usually optional |
| `central_lessons_tag` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_lessons_tag_map` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_models` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_sections` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_tables` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_task` | Unclassified / needs owner decision | False | False | True | true | needs module owner + tenant-scope decision |
| `central_task_delivery_event` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_task_dependency` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_task_run` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_token_usage` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `central_vps_sync_statuses` | Unclassified / needs owner decision | False | False | False | true | needs module owner + tenant-scope decision |
| `content_blueprint` | Website/Studio content support | True | True | False | true | review if used by BOH tenant data |
| `content_draft` | Website/Studio content support | True | False | False | true | review if used by BOH tenant data |
| `content_exchanges` | Website/Studio content support | True | False | False | true | review if used by BOH tenant data |
| `content_projects` | Website/Studio content support | True | True | False | true | review if used by BOH tenant data |
| `content_sections` | Website/Studio content support | True | False | False | true | review if used by BOH tenant data |
| `counter_app_area` | Counter | True | False | False | true | tenant-scoped column present |
| `counter_ticket` | Counter | True | True | True | true | tenant-scoped column present |
| `counter_ticket_comment` | Counter | True | True | False | true | tenant-scoped column present |
| `counter_ticket_priority` | Counter | True | False | False | true | lookup/registry; tenant_id usually optional |
| `counter_ticket_status` | Counter | True | False | False | true | lookup/registry; tenant_id usually optional |
| `forge_walkthrough_artifact` | Forge | True | False | False | true | review if used by BOH tenant data |
| `forge_walkthrough_recipe` | Forge | True | False | False | true | review if used by BOH tenant data |
| `forge_walkthrough_run` | Forge | True | False | False | true | review if used by BOH tenant data |
| `google_calendar_sync` | Slotz calendar integration | True | False | False | true | tenant-scoped column present |
| `google_oauth_tokens` | Slotz calendar integration | True | False | False | true | tenant-scoped column present |
| `keep_activity` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_file` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_file_activity` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_file_approval` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_file_version` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_folder` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_quick_link` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_user_access` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_whiteboard_card` | Keep | True | False | False | true | tenant-scoped column present |
| `keep_whiteboard_item` | Keep | True | False | False | true | tenant-scoped column present |
| `outlook_calendar_sync` | Slotz calendar integration | True | False | False | true | tenant-scoped column present |
| `outlook_oauth_tokens` | Slotz calendar integration | True | False | False | true | tenant-scoped column present |
| `outlook_synced_events` | Slotz calendar integration | True | False | False | true | tenant-scoped column present |
| `patron_activity` | Patron | True | True | False | true | tenant-scoped column present |
| `patron_custom_field` | Patron | True | True | False | true | tenant-scoped column present |
| `patron_lookup` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_organisation` | Patron | True | True | False | true | tenant-scoped column present |
| `patron_organisation_field_value` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_organisation_tag` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_person` | Patron | True | True | False | true | tenant-scoped column present |
| `patron_person_field_value` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_person_organisation` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_person_persona` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_person_tag` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_person_type` | Patron | True | False | False | true | lookup/registry; tenant_id usually optional |
| `patron_persona` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_pipeline_stage` | Patron | True | False | False | true | lookup/registry; tenant_id usually optional |
| `patron_recruiter_intake` | Patron | True | False | False | true | tenant-scoped column present |
| `patron_tag` | Patron | True | True | False | true | tenant-scoped column present |
| `scheduling_availability_rules` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_blackout_dates` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_bookings` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_email_events` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_meeting_types` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_reminder_jobs` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_shared_calendar_owners` | Slotz | True | False | False | true | tenant-scoped column present |
| `scheduling_staff_profiles` | Slotz | True | True | False | true | tenant-scoped column present |
| `soundbyte_profile_audiences` | Agent/AI library | True | False | False | true | review if used by BOH tenant data |
| `soundbyte_profiles` | Agent/AI library | True | True | False | true | review if used by BOH tenant data |
| `tablez_chair` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_chair_assignment_history` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_chair_move_request` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_chair_role` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_project` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_project_status` | Tablez | True | False | False | true | lookup/registry; tenant_id usually optional |
| `tablez_section` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_table` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_task` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_task_dependency` | Tablez | True | True | False | true | tenant-scoped column present |
| `tablez_task_priority` | Tablez | True | False | False | true | lookup/registry; tenant_id usually optional |
| `tablez_task_status` | Tablez | True | False | False | true | lookup/registry; tenant_id usually optional |
