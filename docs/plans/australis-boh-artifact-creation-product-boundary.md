# Australis and BOH Artifact Creation Product Boundary

Status: product architecture recommendation
Scope: generated web assets, source storage, browser preview, conversational editing, agent execution, product entitlements, and Australis to BOH linkage
Owners: Australis platform and BOH Cookbook

## 1. Decision

Use one product capability pattern with two product-owned experiences:

1. **Cookbook Asset Studio** is the full marketing asset production experience for BOH customers.
2. **Australis Artifact Workspace** is the native general-purpose output experience for Australis customers.
3. Customers with both products can let Australis agents work on BOH Cookbook assets through a protected adapter while the canonical asset remains in Cookbook.

Do not put the full capability only inside Australis. BOH-only customers must be able to create and preview marketing assets without purchasing Australis.

Do not copy the complete Cookbook product into Australis. Australis-only customers need a useful artifact workspace, but they do not receive Funnel planning, marketing recipes, campaign asset packs, Pantry, or Cookbook approval workflows unless they purchase BOH Cookbook.

Core rule:

```text
Australis owns general-purpose agent work and artifacts.
Cookbook owns governed marketing asset production.
Funnel owns the customer journey and asset requirements.
```

## 2. Customer experiences by entitlement

### 2.1 BOH-only customer

The customer receives Cookbook Asset Studio with:

- chat-guided asset creation;
- drag-and-drop source and brand files;
- structured Recipes;
- file tree and asset workspace;
- live browser preview for web assets;
- version history;
- review and approval;
- export and approved publishing connections;
- Asset Packs;
- optional Funnel linkage when Funnel is enabled.

This does not require a purchased Australis tenant or a separately configured autonomous agent.

The first release may use a conversational AI assistant and bounded build actions. It does not need to present or provision a persistent autonomous employee-style agent.

### 2.2 Australis-only customer

The customer receives a native Artifact Workspace attached to a Work Session with:

- chat and instructions;
- drag-and-drop source files;
- generated documents and static web artifacts;
- file tree;
- live preview;
- saved versions;
- evidence and final output records;
- human review and approval.

Australis-only does not include:

- Funnel stages or readiness;
- Cookbook marketing Recipes;
- Pantry marketing context;
- marketing Asset Packs;
- campaign production calendars;
- Cookbook's reusable approved marketing Asset Library;
- BOH-specific review, production, or publishing workflows.

The native capability remains valuable because users can ask an Australis agent or Work Session to produce a presentation, report, prototype, information page, dashboard, visual explanation, or other bounded artifact.

### 2.3 Australis and BOH customer

The combined customer receives both experiences and a governed bridge:

- Funnel creates a marketing asset requirement.
- Cookbook creates the canonical Asset and Asset Workspace.
- An authorized Australis Work Session or agent can be assigned to work on that Cookbook Asset.
- Australis reads approved context and writes draft changes through a protected Cookbook adapter.
- Cookbook retains Recipe, draft, review, version, approval, and usage ownership.
- Australis retains Work Session plan, execution evidence, model usage, questions, and agent audit.
- Human approval remains in Cookbook for the asset and in Funnel for accepting a replacement active version.

Australis may show a linked preview and work controls inside the Work Session, but it must not create an independent copy of the Cookbook Asset.

## 3. Product surfaces

## 3.1 Cookbook Asset Studio

Recommended layout:

```text
Left pane: Chat and production steps
Centre pane: Browser preview or document canvas
Right pane: Files, versions, context, review, and usage
```

The layout may be resized but must remain bounded at ordinary desktop widths.

Left pane capabilities:

- conversation history;
- current request and Recipe step;
- ask for or apply a change;
- attach sources;
- run an approved build or render action;
- show blockers and required decisions.

Centre pane capabilities:

- live web preview;
- desktop, tablet, and mobile viewport controls;
- refresh after accepted changes;
- inspect approved output without entering an editor;
- show build or render errors separately from browser console warnings.

Right pane tabs:

- Files;
- Versions;
- Context;
- Review;
- Usage.

Mobile behavior:

- preview remains the primary surface;
- Chat, Files, Versions, Context, Review, and Usage open as bounded bottom sheets;
- the user can return to the same selected file, version, and preview state.

## 3.2 Australis Artifact Workspace

Recommended layout:

```text
Work Session conversation and plan
  + artifact preview
  + files and versions
  + evidence and approval
```

It should feel native to Work Sessions rather than like an embedded BOH app.

Australis may provide:

- a linked artifact panel;
- live browser preview;
- source and output files;
- version comparison;
- agent activity and questions;
- evidence and final output;
- approval actions allowed by the Work Session policy.

When the artifact is a linked Cookbook Asset, the UI must clearly show that Cookbook owns the marketing asset and approval state.

## 4. Artifact types

The first release should support bounded output types that can be safely previewed and versioned.

### Web assets

- landing pages;
- lead magnet delivery pages;
- interactive calculators without protected server-side logic;
- event or webinar information pages;
- embedded forms through approved connectors;
- content hubs;
- reusable HTML sections;
- static microsites.

### Document assets

- lead magnets;
- guides;
- reports;
- checklists;
- workbooks;
- presentations;
- downloadable PDFs.

### Supporting assets

- images;
- icons;
- data files;
- style tokens;
- source documents;
- screenshots;
- preview recordings where supported later.

The first release should not run arbitrary customer backend services or expose runtime secrets to generated browser code.

## 5. Storage model

A generated asset is not one file. The product must preserve the full production package.

### 5.1 Canonical record ownership

Cookbook Asset Studio stores canonical marketing Asset metadata in BOH.

Australis Artifact Workspace stores canonical general Artifact metadata in Australis.

A combined-product link stores stable identifiers in both products but does not duplicate the canonical content tree.

### 5.2 Asset or Artifact record

Stores:

- tenant;
- owner;
- source product;
- title and description;
- output type;
- lifecycle state;
- current version;
- linked request, Funnel stage, Recipe, Project, or Work Session;
- approval state;
- usage references;
- created and updated audit fields.

### 5.3 Workspace snapshot

Each saved version stores an immutable snapshot containing:

- source files;
- generated files;
- dependency manifest;
- build configuration;
- build output;
- preview metadata;
- screenshots where required;
- source references;
- change summary;
- actor and model provenance;
- build and validation result.

### 5.4 Object storage

Binary files, source bundles, build bundles, exports, and screenshots belong in tenant-scoped object storage or an approved asset store. Database records hold metadata and safe object references.

Approved exports may also be surfaced through Keep where that helps normal BOH file access. Keep does not become the owner of Cookbook's production lifecycle, Recipes, approval, or version lineage.

### 5.5 Preview storage

Previews are isolated deployments or render sessions connected to one workspace version.

Rules:

- previews are tenant scoped;
- previews are not production publication;
- previews cannot read BOH Vault values directly;
- generated browser code receives no protected secrets;
- preview URLs expire or require authorization unless explicitly published;
- saved versions remain reproducible after an ephemeral preview stops.

## 6. Conversational and drag-and-drop creation

Users must be able to begin in either direction.

### Conversation-first

Example:

```text
Create a downloadable guide and a delivery page for this lead magnet.
```

The assistant:

1. identifies missing audience, offer, brand, source, and output requirements;
2. asks only material questions;
3. proposes the Asset Pack;
4. creates the workspace;
5. generates or updates files;
6. starts the preview;
7. shows validation results;
8. waits for review or the next instruction.

### Source-first

The user drags in:

- documents;
- copy;
- images;
- brand files;
- an existing source bundle;
- spreadsheets or structured data.

The assistant classifies the sources, suggests an appropriate Recipe or output, and asks for approval before producing the asset.

### Direct manipulation

The first release may support:

- reorder sections;
- replace images;
- select variants;
- edit bounded text fields;
- choose layout or theme options;
- upload files;
- accept or reject proposed changes.

A later phase may add full visual drag-and-drop page composition. The product should not delay the chat plus preview MVP until a complete no-code page builder exists.

## 7. Execution model

### 7.1 No persistent agent required for BOH-only

Cookbook can begin with a bounded AI production assistant that:

- receives a request;
- reads allowed context;
- proposes a plan;
- applies file changes;
- runs approved build and validation actions;
- returns a preview and evidence.

This is an AI-assisted job runner, not necessarily a persistent autonomous agent with a role, Chair, memory, or delegated sub-agents.

### 7.2 Australis agent execution

When Australis is purchased, a user may assign an Artifact or linked Cookbook Asset to an Australis Work Session or agent.

Australis adds:

- governed plans;
- clarifying questions;
- long-running execution;
- agent and sub-agent assignment where permitted;
- model and cost controls;
- evidence;
- human approvals;
- scheduled or recurring work later.

### 7.3 Shared job contract

Both surfaces should use the same product-neutral action contract where practical:

- create workspace;
- read allowed files and context;
- propose changes;
- apply file changes;
- save snapshot;
- build;
- validate;
- create preview;
- request review;
- return approved or final output.

The contract does not transfer product ownership. BOH and Australis use their own Gateways, policies, entitlements, and records.

## 8. Entitlements

BOH remains the commercial source of truth for Australis and BOH purchases.

Recommended capability entitlements:

- `boh.cookbook.enabled`;
- `boh.cookbook.asset_studio`;
- `boh.funnel.enabled`;
- `australis.enabled`;
- `australis.artifacts.enabled`;
- `australis.agent_execution`;
- `australis.boh_bridge` for linked Work Session access to BOH records.

Entitlement behavior:

| Purchase | Experience |
|---|---|
| BOH Cookbook only | Full Cookbook Asset Studio with bounded AI assistant |
| BOH Cookbook and Funnel | Asset Studio plus structured Funnel requirements and readiness |
| Australis only | Native general Artifact Workspace inside Work Sessions |
| Australis plus BOH Cookbook | Australis agents can work on linked canonical Cookbook Assets |
| Australis plus BOH Cookbook and Funnel | Full journey to request, production, agent work, approval, and Funnel fulfillment |

Do not provision a full Australis tenant for BOH-only customers merely to run Asset Studio. Do not provision a full BOH workspace for Australis-only customers merely to store native Artifacts.

## 9. Product boundary for lead magnets

A lead magnet often produces multiple deliverables, so Cookbook should store it as an Asset Pack.

Example pack:

- research and source brief;
- downloadable guide or workbook;
- cover and supporting images;
- landing page;
- delivery page;
- confirmation copy;
- delivery email;
- follow-up sequence;
- social or ad variants;
- source workspace and build bundle;
- screenshots and approved exports.

Funnel references the approved versions needed by its lead capture, delivery, and nurture stages.

Australis-only users may create a guide and static page as general Artifacts, but they do not receive the Funnel or Cookbook operating model without BOH.

## 10. Publishing and export

The first release should distinguish:

- Preview;
- Approved;
- Exported;
- Published.

Export options may include:

- source bundle;
- static build bundle;
- PDF;
- image package;
- copy package;
- approved file references in Keep.

Publishing to a domain, email platform, or external service requires an approved connector, explicit authorization, and auditable action. Preview success must never be displayed as proof of production publication.

## 11. Security and isolation

1. Every workspace, file, snapshot, preview, build, and link is tenant scoped.
2. Preview and build workers run in isolated environments with bounded resources.
3. Generated browser code receives no raw BOH Vault secret.
4. Protected external actions occur through approved server-side connectors.
5. File uploads are scanned and type checked.
6. Network access is denied by default and allowlisted per approved action.
7. Builds have time, memory, storage, and process limits.
8. Logs separate build failures, browser errors, and non-blocking console warnings.
9. Agent and assistant actions record actor, model, context, file changes, build result, cost, and approval state.
10. Public publishing requires an explicit approval gate.
11. Combined-product access uses stable tenant and account mapping, not email alone.

## 12. Recommended rollout

### Phase 1: Cookbook Asset Studio MVP

- Cookbook Asset and version model;
- file upload and source workspace;
- chat-guided file changes;
- static web and document outputs;
- browser preview;
- immutable snapshots;
- review and approval;
- export;
- Funnel requirement linkage.

### Phase 2: Australis Artifact Workspace MVP

- Work Session artifact panel;
- chat, files, preview, versions, evidence, and approval;
- general static web and document artifacts;
- Australis-owned artifact records;
- no BOH dependency.

### Phase 3: Combined-product bridge

- assign a Cookbook Asset to an Australis Work Session;
- protected read and mutation adapter;
- linked preview and evidence;
- Cookbook approval remains canonical;
- Funnel accepts approved replacement versions.

### Phase 4: Advanced composition and publishing

- richer drag-and-drop composition;
- approved publishing connectors;
- custom domains;
- form and measurement connectors;
- recurring agent production;
- performance-based revision requests;
- reusable components and tenant templates.

## 13. Acceptance tests for the product decision

The model is correct when:

1. A BOH-only user can create, preview, review, approve, and export a lead magnet Asset Pack without an Australis purchase.
2. An Australis-only user can create and preview a useful general Artifact within a Work Session without BOH.
3. A combined customer can assign a canonical Cookbook Asset to an Australis Work Session without copying it.
4. Cookbook remains the source of truth for marketing Asset versions and approvals.
5. Funnel remains the source of truth for requirements and readiness.
6. Australis remains the source of truth for Work Session execution, evidence, agents, and cost.
7. Preview environments cannot access raw secrets or production data by default.
8. A new draft never silently replaces an approved version used by an active Funnel.
9. Entitlement checks do not require unnecessary cross-product provisioning.
10. Customer-facing UI does not expose implementation terms such as sandbox service, object key, provider route, or database ownership.
