# BOH Cookbook Product Requirements Document

Status: reconciled product definition baseline
Scope: BOH Cookbook recipes, guided asset production, review and approval, versions, reusable context, asset packs, and Funnel fulfillment
Owner: Australis / BOH marketing operations
Related product: BOH Funnel

## 1. Product intent

Cookbook is the BOH application for consistently creating, reviewing, approving, versioning, and reusing the marketing assets a business needs.

It turns repeatable marketing methods into guided recipes. Each recipe collects the right business, audience, offer, voice, source, and channel inputs, then moves the resulting asset through a controlled production lifecycle.

Core promise:

```text
Cookbook turns a clear brief and a proven recipe into an approved asset pack the business can confidently use.
```

Cookbook is not a folder of prompts and it is not a catalog of disconnected AI generators. It is the production and approval source of truth for BOH marketing assets.

## 2. Product boundary

### 2.1 Cookbook owns

Cookbook is the system of record for:

- recipes and recipe steps;
- recipe families and supported asset types;
- structured asset requests received from Funnel or created directly;
- asset briefs and required inputs;
- research and source material references;
- selection of shared audience, offer, brand, and voice context;
- content projects and asset packs;
- drafts, variants, sections, and supporting outputs;
- review, changes requested, and approval workflows;
- asset versions and lineage;
- channel-specific adaptation;
- approved asset metadata and usage references;
- controlled revision requests;
- reusable production history and recipe reuse.

### 2.2 Cookbook does not own

Cookbook does not own:

- Funnel stage order, dependencies, conversion goals, or launch readiness;
- customer and prospect records owned by Patron;
- general project and task management unrelated to asset production;
- a second copy of business, audience, offer, or voice records;
- publishing credentials or secrets;
- billing and entitlements;
- unrestricted production publishing;
- a second campaign planner inside Reservations or asset detail screens;
- asset files that belong in an approved shared file or asset store.

### 2.3 Funnel boundary

Funnel decides what must happen, in what order, for which audience and offer, and toward which conversion objective.

Cookbook receives the structured requirement, creates and approves the asset, and returns a specific approved version.

Cookbook may show where an asset is used. It must not become a second Funnel planner.

### 2.4 Shared context boundary

Business, brand, audience, offer, voice, proof points, constraints, and source material must be shared BOH records or governed references. Recipes select and use them. Recipes do not create silent, disconnected copies.

## 3. Current Cookbook baseline

The current BOH code already provides these Cookbook areas:

- **Pantry** for Soundbytes, AI personas, and knowledge packs;
- **QuickServe** for short-form posts, hooks, scripts, captions, and snippets;
- **Slow Cook** for long-form stories, interviews, sections, and chapters;
- **Reservations** for campaign and content scheduling views;
- **Recipes** for reusable templates and page or block definitions.

The existing content foundation includes:

- content projects;
- content sections;
- content exchanges;
- raw, draft, and final content fields;
- AI personas and knowledge packs;
- Soundbyte profiles and audience variants;
- storyboard interview and draft workflows.

This PRD preserves the useful intent of those features while adding the missing product contract:

- structured asset requests;
- explicit recipes and steps;
- asset lifecycle;
- approval and version lineage;
- asset packs;
- Funnel fulfillment;
- stable shared context references;
- ownership and audit requirements.

## 4. Reconciliation of current feature names

### 4.1 Pantry

Pantry remains the reusable context and source area.

It may contain or reference:

- Soundbytes and approved messaging statements;
- audiences;
- brand voices or approved communication profiles;
- proof points;
- source documents;
- interviews;
- knowledge packs;
- reusable hooks and stories.

Current AI personas must be reviewed so that they do not become a duplicate source of truth for Australis agents or BOH users. A Cookbook communication profile is for asset voice and production behavior, not an independent employee or autonomous agent identity.

### 4.2 QuickServe

QuickServe remains a fast production path for a single bounded output.

It should use the same asset lifecycle and version contract as all Cookbook work. A quick output can still be:

- Draft;
- In review;
- Changes requested;
- Approved;
- Published or active;
- Retired.

QuickServe is not allowed to bypass review, provenance, or version history merely because the output is short.

### 4.3 Slow Cook

Slow Cook remains the guided long-form production experience.

The current interview, outline, section, raw draft, generated draft, and final content model is a strong base for:

- articles;
- guides;
- scripts;
- presentations;
- webinars;
- VSLs;
- customer stories;
- books or chapters;
- structured campaign narratives.

Slow Cook must produce a canonical Asset or Asset Pack rather than leaving the result only as an internal content project.

### 4.4 Reservations

Reservations must be narrowed to Cookbook's ownership boundary.

Cookbook may own:

- requested publish date;
- content due date;
- review deadline;
- planned channel window;
- asset production calendar;
- linked publishing status returned by an approved connector.

Funnel owns:

- campaign timing;
- stage activation;
- launch readiness;
- offers, banners, bonuses, and conversion scheduling when those records affect the customer journey.

Current `boh_campaign_banner` and `boh_campaign_bonus_tier` records are already classified as Funnel/campaign data in the BOH ownership review. Cookbook may link the assets used by those records, but it should not remain their canonical owner.

### 4.5 Recipes

Recipes become the main reusable production method rather than a lightweight page-template list.

A Recipe includes:

- purpose;
- supported asset type;
- supported channels;
- required and optional inputs;
- ordered steps;
- research expectations;
- context requirements;
- generation or writing guidance;
- review checkpoints;
- completion criteria;
- output structure;
- adaptation rules;
- version.

## 5. Primary users

### Business owner or marketing lead

Selects goals, approves shared context, reviews asset packs, and controls final approval.

### Marketing operator

Receives requests, chooses recipes, collects inputs, produces drafts, coordinates reviews, and returns approved assets to Funnel.

### Writer, designer, or specialist

Completes assigned recipe steps and contributes drafts or variants.

### Reviewer or approver

Reviews against the brief, brand, audience, offer, claims, and channel requirements.

### Funnel operator

Creates an asset request and receives an approved asset version without managing Cookbook's internal production workflow.

### Australis commercial or content agent

May research, prepare drafts, summarize sources, or complete approved recipe steps within granted capabilities. It cannot self-approve assets or bypass production gates.

## 6. Goals

1. Replace one-off prompting with repeatable, governed production recipes.
2. Reuse shared business, audience, offer, and voice context across all outputs.
3. Produce complete asset packs for Funnel stages and campaigns.
4. Make production status, ownership, review, and approval visible.
5. Preserve version lineage and active usage references.
6. Support direct creation and Funnel-requested creation without duplicating workflows.
7. Feed one body of research into multiple channel-specific assets.
8. Keep short-form and long-form production inside one consistent lifecycle.
9. Support human-led and approved agent-assisted work without allowing silent production changes.

## 7. Non-goals for the first release

The first release will not provide:

- a separate mini-application for every writing framework;
- automatic publishing to every channel;
- unrestricted image, audio, or video generation;
- a public template marketplace;
- campaign stage planning owned by Funnel;
- contact or influencer CRM owned by Patron;
- advanced attribution or performance analytics;
- fully autonomous approval;
- duplication of shared BOH context records.

## 8. Core entities

### 8.1 Recipe

A reusable guided method for producing one asset or asset pack.

Required fields:

- id;
- tenant or BOH-managed template scope;
- name;
- description;
- recipe family;
- supported asset types;
- supported channels;
- required context;
- status;
- owner;
- version;
- created and updated audit fields.

Suggested statuses:

- Draft;
- In review;
- Approved;
- Retired.

### 8.2 Recipe step

An ordered instruction, input, production action, or review checkpoint.

Step types may include:

- Select context;
- Add source;
- Research;
- Define angle;
- Draft;
- Adapt;
- Review;
- Approve;
- Package.

### 8.3 Asset request

A structured brief received from Funnel or created directly in Cookbook.

Required fields:

- tenant;
- source product and source record;
- asset type;
- purpose;
- audience reference;
- offer reference;
- brand or voice reference where relevant;
- channel;
- due date;
- owner;
- success intent;
- source material references;
- revision source version when applicable.

### 8.4 Content project

A bounded production workspace created from a Recipe and Asset request.

It may reuse the current content project foundation after ownership, tenant scope, and field contracts are reconciled.

### 8.5 Research brief

Stores the topic, questions, findings, approved claims, source references, ideas, and angles that may feed one or more assets.

### 8.6 Asset

The durable marketing deliverable.

Required fields:

- tenant;
- name;
- asset type;
- recipe;
- audience reference;
- offer reference;
- brand or voice reference;
- source request;
- owner;
- lifecycle state;
- current approved version;
- usage summary;
- created and updated audit fields.

### 8.7 Asset section

An ordered part of a long-form or structured asset. Existing content section concepts may be reused.

### 8.8 Asset version

An immutable saved version of an Asset.

Required fields:

- asset;
- version number;
- format and channel;
- content or file reference;
- change summary;
- created by;
- created at;
- review status;
- approval evidence;
- superseded version where applicable.

### 8.9 Asset variant

A channel, audience, format, or test-specific adaptation derived from an Asset version.

### 8.10 Review

A review event containing reviewer, decision, comments, requested changes, and timestamp.

### 8.11 Approval

Evidence that one exact Asset version is approved for its stated purpose and channel.

### 8.12 Asset pack

A grouped set of assets produced for one Funnel, campaign, launch, or business goal.

Examples:

- lead magnet Funnel pack;
- webinar pack;
- welcome and nurture pack;
- social launch pack;
- sales follow-up pack.

### 8.13 Asset usage link

Records where one exact approved version is used, including Funnel and stage references.

## 9. Asset lifecycle

Use one visible lifecycle across QuickServe, Slow Cook, and recipe-based production:

```text
Brief
  -> Researching
  -> Drafting
  -> In review
  -> Changes requested
  -> Approved
  -> Published or active
  -> Retired
```

Rules:

1. A draft cannot be treated as approved because it has generated content.
2. Approval applies to one exact version.
3. A new draft does not overwrite the active approved version.
4. A published or active version retains its Funnel and usage references.
5. Retiring an asset does not erase historical usage or approval evidence.
6. Agent-produced work must show provenance and still pass required review.

## 10. Recipe families

Initial recipe families should cover complete business outcomes rather than isolated prompt categories.

### 10.1 Lead magnet Funnel pack

May produce:

- lead magnet;
- landing-page copy;
- confirmation copy;
- delivery email;
- welcome and nurture sequence;
- social and ad variants.

### 10.2 Webinar or event pack

May produce:

- presentation outline;
- word-for-word script;
- registration copy;
- reminder emails;
- follow-up emails;
- social promotion;
- offer and call-to-action copy.

### 10.3 VSL pack

May produce:

- research brief;
- hook and angle options;
- VSL outline;
- script;
- page copy;
- follow-up sequence;
- ad and social variants.

### 10.4 Welcome and nurture pack

May produce:

- welcome sequence;
- story sequence;
- value emails;
- offer transition;
- re-engagement variants.

### 10.5 Social launch pack

Uses a shared workflow:

1. Research the topic.
2. Save useful findings and angles.
3. Select a storytelling format.
4. Produce channel-specific assets.
5. Review and approve the pack.

Supported outputs may include short video scripts, carousels, image posts, text posts, LinkedIn posts, captions, and email snippets.

### 10.6 Sales follow-up pack

May produce:

- initial follow-up;
- objection responses;
- case-study proof;
- reminder sequence;
- close or next-step message;
- stalled-opportunity re-engagement.

## 11. Information architecture

Primary navigation:

```text
Cookbook
  Overview
  Recipes
  In production
  Review
  Approved assets
  Asset packs
  Pantry
```

QuickServe and Slow Cook become production modes or filters inside the shared lifecycle rather than separate sources of truth.

### 11.1 Overview

Shows:

- incoming Funnel requests;
- work due soon;
- assets in review;
- changes requested;
- recently approved assets;
- production blockers;
- recipe reuse.

### 11.2 Recipes

Shows approved and draft Recipes, supported outputs, expected inputs, completion criteria, and version history.

### 11.3 In production

Use a bounded master-detail layout.

Left pane:

- requests and content projects;
- search;
- status, owner, Funnel, channel, asset type, and due-date filters.

Centre pane:

- selected Recipe steps;
- required inputs;
- research;
- draft sections and variants;
- progress and next action.

Right drawer:

- Funnel and stage context;
- audience and offer;
- brand and voice;
- source material;
- owners and due dates;
- review comments;
- version history;
- usage locations.

### 11.4 Review

Shows versions waiting for review, changes requested, reviewers, approval requirements, and decision history.

### 11.5 Approved assets

Provides the canonical searchable asset library with type, audience, offer, owner, version, approval state, and usage references.

### 11.6 Asset packs

Groups approved and in-progress outputs around one Funnel, launch, project, or business outcome.

### 11.7 Pantry

Provides reusable context and source material without duplicating shared BOH records.

## 12. Primary workflows

### 12.1 Start from a Funnel request

1. Open the incoming Asset request.
2. Review Funnel, stage, purpose, audience, offer, channel, due date, and success intent.
3. Confirm or request missing context.
4. Select a Recipe.
5. Create the content project.
6. Complete recipe steps.
7. Submit one or more versions for review.
8. Approve one exact version.
9. Return that version to the originating Funnel requirement.

### 12.2 Start directly in Cookbook

1. Choose the desired output or business goal.
2. Select a Recipe.
3. Select shared business, audience, offer, and voice context.
4. Add sources and a brief.
5. Complete production and review.
6. Save the approved Asset or Asset Pack.
7. Optionally link it to a Funnel requirement.

### 12.3 Research to multi-channel pack

1. Create or select a Research brief.
2. Add approved sources and findings.
3. Save useful ideas, claims, hooks, and angles.
4. Select one or more storytelling or campaign formats.
5. Produce channel-specific variants from the shared message.
6. Review each variant against channel requirements.
7. Approve and package the outputs.

### 12.4 Request changes

1. Reviewer selects Changes requested.
2. Comments identify the affected version and required changes.
3. Production creates a new draft version.
4. The previous approved version remains available and unchanged.
5. The new version enters review.

### 12.5 Replace an asset used by Funnel

1. Cookbook receives a revision request linked to the active version.
2. A new draft and version lineage are created.
3. Reviewers approve the replacement version.
4. Cookbook offers the approved version back to Funnel.
5. Funnel must explicitly accept the replacement.
6. Usage and audit history record the change.

## 13. Funnel handoff contract

Cookbook accepts:

- tenant;
- Funnel;
- stage;
- requirement id;
- asset type;
- purpose;
- audience, offer, brand, and voice references;
- channel;
- due date;
- owner;
- success intent;
- source references;
- current version for revisions.

Cookbook returns:

- asset id;
- approved asset version id;
- lifecycle status;
- owner and approver;
- approval timestamp;
- preview or safe access reference;
- channel and format metadata;
- version lineage.

Cookbook status is canonical. Funnel readiness derives from the approved version link.

## 14. Onboarding and activation

Cookbook onboarding is outcome-based, contextual, skippable, searchable, and resumable.

### Cookbook starter

1. Choose an output or open a Funnel request.
2. Select a Recipe.
3. Confirm audience, offer, and voice context.
4. Add source material or complete the brief.
5. Create the first draft.
6. Review or request review.
7. Approve one Asset version.
8. Save it to Approved assets.
9. Return it to Funnel when the work came from a Funnel request.

The completed outcome is an approved reusable asset, not a completed lesson.

Contextual learning explains:

- what a Recipe does;
- what belongs in Pantry;
- how shared context is reused;
- how review and approval work;
- how versions protect active Funnel usage;
- how an Asset Pack differs from a single output.

Longer training can remain available separately and should open from the relevant workflow.

## 15. Permissions and governance

1. Every Recipe, request, project, asset, version, review, approval, pack, and usage link is tenant scoped unless it is an explicitly governed BOH template.
2. App access follows BOH tenant entitlement and membership.
3. Recipe management, drafting, reviewing, approving, publishing, and retiring may have separate permissions.
4. The creator cannot satisfy a required independent approval when separation of duties is configured.
5. Agents cannot approve their own outputs or bypass human gates.
6. Every generation, material edit, review, approval, replacement, and retirement is auditable.
7. Source provenance must remain available for generated or summarized claims.
8. BOH application ownership uses `public.boh_user.id`, not direct `auth.users.id` comparisons.
9. Protected provider credentials and publishing secrets remain in BOH Vault or approved connected services.

## 16. Current data and migration considerations

1. Existing `content_projects`, `content_sections`, `content_draft`, and `content_exchanges` are currently classified as Website/Studio content support in the BOH ownership review. Before making them canonical Cookbook records, confirm ownership and migration boundaries rather than assuming shared names imply Cookbook ownership.
2. Existing content functions already provide tenant-scoped access patterns that can inform the Cookbook implementation, but the PRD requires explicit Asset, Asset version, Review, Approval, and usage contracts.
3. Existing `soundbyte_profiles`, audience variants, AI personas, and knowledge packs need a shared-context ownership decision. Cookbook should reference canonical records where possible.
4. Existing `boh_campaign_banner` and `boh_campaign_bonus_tier` records belong to Funnel/campaign ownership. Cookbook can provide their approved creative assets.
5. Existing Recipes are lightweight definitions. They require versioned steps, inputs, completion criteria, review checkpoints, and output contracts.
6. Existing QuickServe outputs need durable Asset and version records rather than response-only content.
7. Existing Slow Cook final content must be promoted into the canonical Asset lifecycle.
8. No migration should overwrite or silently reclassify production data without a reviewed mapping and tenant-safe verification.

## 17. Asset Studio

Asset Studio is Cookbook's full production workspace for assets that require files, generated web output, document rendering, browser preview, version snapshots, or iterative conversational changes.

It must be available to BOH-only customers and cannot require an Australis purchase.

### 17.1 Product experience

Use a bounded three-pane desktop workspace:

- **Left pane:** conversation, current Recipe step, required decisions, and production actions;
- **Centre pane:** live browser preview or document canvas with desktop, tablet, and mobile viewport controls;
- **Right pane:** Files, Versions, Context, Review, and Usage tabs.

On mobile, keep the preview primary and open the other areas as bounded bottom sheets while preserving the selected file, version, and preview state.

Users can begin by:

- describing the required asset in chat;
- opening a Funnel Asset request;
- selecting a Recipe;
- dragging in copy, documents, images, data, brand files, or an existing source bundle.

The assistant asks only material questions, proposes the output or Asset Pack, creates the workspace, applies bounded file changes, starts a preview, reports validation results, and waits for review.

### 17.2 Initial output types

Asset Studio initially supports:

- landing pages;
- lead magnet delivery pages;
- static microsites;
- reusable HTML sections;
- downloadable guides, reports, checklists, and workbooks;
- presentations and PDFs;
- images, icons, style tokens, data files, and source bundles.

The first release does not run arbitrary customer backend services or expose protected values to generated browser code.

### 17.3 Lead magnet Asset Packs

A lead magnet should be stored as an Asset Pack rather than one flattened file. A pack may include:

- research and source brief;
- downloadable guide or workbook;
- cover and supporting images;
- landing page;
- delivery page;
- confirmation copy;
- delivery and follow-up emails;
- social or ad variants;
- source workspace;
- build bundle;
- screenshots and approved exports.

Funnel links the approved versions needed by its capture, delivery, and nurture stages.

### 17.4 Storage and versions

Each saved version must preserve an immutable workspace snapshot containing:

- source and generated files;
- dependency manifest and build configuration;
- build output;
- preview metadata;
- screenshots where required;
- source references;
- change summary;
- actor and model provenance;
- validation result.

Binary files, source bundles, build bundles, exports, and screenshots belong in tenant-scoped object storage or an approved asset store. Cookbook records retain safe references, version lineage, approval, and usage metadata.

Approved exports may also be surfaced through Keep. Keep does not become the owner of Cookbook Recipes, production status, approval, or version lineage.

### 17.5 Preview and publishing states

Asset Studio must distinguish:

- Preview;
- Approved;
- Exported;
- Published.

A preview is isolated, tenant scoped, and linked to one saved version. Preview success is not proof of production publication. Preview code cannot read BOH Vault values directly.

Publishing requires an approved connector, explicit authorization, and an auditable action.

### 17.6 BOH-only AI assistance

Cookbook begins with a bounded conversational production assistant. It may read allowed context, propose a plan, apply file changes, run approved build and validation actions, and return a preview.

It does not require a persistent autonomous agent, Chair, delegated sub-agents, or an Australis tenant.

When Australis is also enabled, an authorized Work Session or agent may work on the canonical Cookbook Asset through a protected adapter. Cookbook still owns the Asset, Recipe, versions, reviews, approvals, and usage.

### 17.7 Security requirements

1. Every workspace, file, snapshot, build, preview, and export is tenant scoped.
2. Build and preview workers use isolated bounded environments.
3. Network access is denied by default and allowed only for approved actions.
4. Generated browser code receives no raw protected value.
5. File uploads are scanned and type checked.
6. Builds have time, process, memory, and storage limits.
7. Build failures, browser errors, and non-blocking console warnings are reported separately.
8. Public publication requires explicit approval.

## 18. Shared product integrations

### Funnel

Provides structured asset requirements and receives approved versions.

### Patron

Provides customer, segment, organisation, activity, and opportunity context without transferring CRM ownership to Cookbook.

### Projects and tasks

Provide assignment, due dates, dependencies, and work tracking with source provenance.

### Keep

Stores governed files and documents where appropriate. Cookbook stores safe references and asset metadata.

### BOH Vault

Stores and delivers protected provider or publishing credentials.

### Australis

May perform approved research and production Work Sessions and return evidence. Cookbook remains the owner of asset records and approvals.

## 19. MVP requirements

The first release must provide:

1. Tenant-scoped Recipes with ordered steps and required inputs.
2. Direct and Funnel-originated Asset requests.
3. Shared context references for audience, offer, brand, voice, and sources.
4. A content project created from a request and Recipe.
5. Draft, review, changes requested, approved, active, and retired lifecycle states.
6. Immutable Asset versions and lineage.
7. Review and approval evidence.
8. Approved Asset library.
9. Asset Packs.
10. Funnel usage links and return of one approved version.
11. A common lifecycle for QuickServe and Slow Cook outputs.
12. Tenant-safe ownership, permissions, and audit.
13. A bounded three-pane Asset Studio on desktop and usable mobile sheets.
14. Chat-guided creation and iterative file changes.
15. Drag-and-drop source and brand files.
16. Static web and document output workspaces.
17. Live browser or document preview.
18. Immutable source, build, preview, and export snapshots.
19. Isolated bounded build and preview execution.
20. Export without requiring an Australis purchase.

## 20. Initial release recipes

Prioritize:

1. Lead magnet Funnel pack.
2. Webinar or event pack.
3. VSL pack.
4. Welcome and nurture email pack.
5. Social launch pack.
6. Sales follow-up pack.

These should produce complete assets for a Funnel outcome. Individual framework options can exist inside the relevant Recipe instead of becoming separate top-level software products.

## 21. Deferred capabilities

Later phases may add:

- additional presentation and email frameworks;
- paid ad testing packs;
- customer story packs;
- partner and influencer outreach packs;
- reusable Research and Idea boards;
- channel publishing connectors;
- A/B test variants;
- performance-based revision suggestions;
- media generation and editing;
- cross-Funnel reuse recommendations;
- governed Recipe sharing across tenants;
- an approved Recipe marketplace;
- agent-operated recurring production routines.

## 22. Acceptance criteria

The MVP is acceptable when:

1. A permitted user can create or select a Recipe with explicit steps and inputs.
2. A user can create an Asset request directly or receive one from Funnel.
3. The request references canonical shared audience, offer, brand, and voice records.
4. A user can move the work through draft, review, changes requested, and approved states.
5. Approval applies to one immutable Asset version.
6. A new revision does not overwrite an active approved version.
7. An approved version can fulfill a Funnel requirement.
8. Cookbook shows where an approved version is used without duplicating Funnel planning.
9. QuickServe and Slow Cook outputs enter the same Asset lifecycle.
10. Current campaign timing records are not incorrectly treated as Cookbook-owned assets.
11. Every material action is tenant scoped, permission checked, and auditable.
12. No agent can approve its own output or bypass production gates.
13. Desktop and mobile workflows preserve selected request, project, asset, file, and version context.
14. A BOH-only user can create, preview, review, approve, and export a lead magnet Asset Pack without Australis.
15. Chat changes produce reviewable file changes and a new saved version rather than silently overwriting the approved version.
16. A saved web version can be reproduced after its ephemeral preview ends.
17. Generated browser code cannot access raw protected values.
18. Preview success is not displayed as production publication.

## 23. Success measures

Track:

- time to first approved Asset;
- percentage of new tenants that approve one Asset;
- percentage of Cookbook Assets created from Funnel requests;
- percentage of Funnel requests fulfilled by approved versions;
- time from request to first draft;
- approval cycle time;
- changes-requested rate;
- Recipe reuse rate;
- Asset Pack completion rate;
- percentage of active Assets with usage references;
- duplicate audience, offer, brand, or voice record rate;
- percentage of work completed through structured Recipes rather than assistant-only interactions;
- onboarding resume and completion rate.

## 24. Source-of-truth rules

1. Cookbook owns Recipes, production, review, approval, Assets, and versions.
2. Funnel owns journey stages, requirements, readiness, and launch coordination.
3. Patron owns people, organisations, activities, and CRM records.
4. Shared BOH context owns business, audience, offer, brand, and voice records.
5. Shared projects and tasks own general work tracking.
6. Keep or the approved asset store owns governed files; Cookbook owns asset metadata and version references.
7. BOH Vault owns protected integration values.
8. Australis may assist through approved Work Sessions but does not replace Cookbook records or approvals.
