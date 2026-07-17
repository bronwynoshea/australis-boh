# BOH Funnel Product Requirements Document

Status: product definition baseline
Scope: BOH customer journeys, sales opportunities, reportable pipeline milestones, Funnel to Cookbook asset requests, readiness, launch coordination, and performance feedback
Owner: Australis / BOH commercial operations
Related product: BOH Cookbook

## 1. Product intent

Funnel is the BOH application for planning, operating, and measuring the path from first attention through conversion and follow-up.

It gives business owners and commercial teams one source of truth for:

- who a funnel is for;
- which offer it promotes;
- what the audience should do next;
- which stages and touchpoints move the audience toward the goal;
- which assets each stage requires;
- whether those assets are approved and ready;
- who owns each operational action;
- where the funnel is incomplete, blocked, or underperforming.

Core promise:

```text
Funnel shows the complete customer journey, what each stage needs, and whether the business is ready to put it into market.
```

## 2. Product boundary

### 2.1 Funnel owns

Funnel is the system of record for:

- funnels and campaigns;
- funnel goals and measurable conversion objectives;
- audiences and offers assigned to funnels;
- entry points, traffic sources, channels, and touchpoints;
- ordered journey stages and stage dependencies;
- stage entry and completion conditions;
- calls to action and conversion points;
- asset requirements declared by stages;
- placement of approved asset versions within stages;
- funnel and stage readiness;
- launch status and operating dates;
- stage ownership and linked operational tasks;
- stage and funnel performance summaries;
- revision requests created from missing or underperforming funnel elements.

### 2.2 Funnel does not own

Funnel does not own:

- long-form asset editing;
- reusable asset recipes;
- draft history or asset approval workflows;
- brand, audience, offer, or voice records that already belong to shared BOH context;
- prospect or customer records owned by Patron;
- general project and task management owned by BOH shared services;
- publishing credentials or secrets owned by BOH Vault;
- product billing or entitlements;
- a separate AI chat-only copy of funnel state.

### 2.3 Cookbook boundary

Cookbook creates, reviews, versions, approves, and reuses the assets required by Funnel.

Funnel may:

- declare an asset requirement;
- send a structured asset request to Cookbook;
- preview an asset;
- link an approved asset version;
- show the asset's approval and readiness state;
- request a revision.

Funnel must not contain a second asset editor or independently change Cookbook asset status.

### 2.4 Patron boundary

Patron remains the source of truth for people, organisations, relationships, activities, and customer history.

Funnel owns sales opportunities, opportunity stages, probabilities, milestones, forecasts, and outcome history. Every Opportunity links to one or more Patron people or organisations without duplicating those CRM records.

Patron may show a summary of linked Funnel opportunities, but it must not keep a second editable sales pipeline.

## 3. Primary users

### Business owner or commercial lead

Defines goals, audiences, offers, launch timing, and approval expectations. Reviews readiness and performance.

### Marketing operator

Builds funnel stages, identifies required assets, coordinates Cookbook requests, and prepares the funnel for launch.

### Sales or customer operator

Uses Funnel opportunities and Patron relationship context to understand the sales milestone, next action, required follow-up, and conversion intent.

### Asset owner

Receives structured requests in Cookbook and returns approved asset versions to Funnel.

### Approver

Reviews stage readiness, asset approval evidence, and launch gates.

### Australis commercial or growth agent

May identify blockers, prepare recommendations, create draft requests, or summarize performance after the relevant BOH app and agent permissions are enabled. It cannot bypass human approval or production gates.

## 4. Goals

1. Give each tenant a clear, auditable representation of its customer journeys.
2. Connect funnel stages to approved marketing assets without duplicating those assets.
3. Make missing requirements and launch blockers visible.
4. Preserve one shared source of truth for business, audience, offer, voice, contacts, tasks, and assets.
5. Support both human-led and approved agent-assisted commercial work.
6. Let performance findings create controlled Cookbook revision requests.
7. Keep active funnels linked to specific approved asset versions.
8. Support enterprise ownership, approval, audit, and tenant isolation.

## 5. Non-goals for the first release

The first release will not provide:

- a public website or landing-page hosting platform;
- an email service provider;
- a paid advertising network connector;
- a complete visual page builder;
- an unrestricted automation canvas;
- automatic production publishing without approval;
- predictive attribution or advanced revenue forecasting;
- a marketplace of third-party funnel templates;
- a replacement for Patron CRM.

These may be integrated or expanded later without changing Funnel's ownership boundary.

## 6. Core entities

### 6.1 Funnel

A tenant-scoped customer journey definition.

Required fields:

- id;
- tenant id;
- name;
- description;
- business or brand reference;
- audience reference;
- offer reference;
- conversion objective;
- owner;
- status;
- readiness state;
- planned start and end dates;
- created and updated audit fields.

Suggested statuses:

- Draft;
- Planning;
- In production;
- Ready for review;
- Ready to launch;
- Active;
- Paused;
- Completed;
- Archived.

### 6.2 Journey stage

An ordered step in the audience journey.

Journey stages describe marketing and customer experience touchpoints. They are separate from reportable sales Opportunity stages.

Required fields:

- funnel id;
- name;
- purpose;
- sequence;
- channel or touchpoint;
- entry condition;
- completion condition;
- conversion objective;
- call to action;
- owner;
- readiness state.

Examples include:

- awareness;
- lead capture;
- confirmation;
- nurture;
- event or presentation;
- offer;
- checkout or booking;
- onboarding;
- follow-up;
- re-engagement.

### 6.3 Stage dependency

Defines ordering or conditional movement between stages.

The first release needs ordered stages and simple optional branches. Advanced event automation is deferred.

### 6.4 Opportunity

A tenant-scoped commercial opportunity linked to Patron people or organisations and one Funnel.

Required fields:

- id;
- tenant id;
- Funnel id;
- primary Patron organisation reference;
- linked Patron people;
- name;
- owner;
- current Opportunity stage;
- value and currency;
- stage default probability;
- optional Opportunity-specific probability override;
- expected close date;
- next action and due date;
- source;
- status and outcome;
- created and updated audit fields.

An organisation or person can participate in more than one Opportunity. Sales stage must therefore not be stored only on the Patron person or organisation record.

### 6.5 Opportunity stage definition

A reportable sales milestone with explicit entry and exit meaning.

Required fields:

- tenant or governed template scope;
- key;
- label;
- reportable milestone;
- exit criteria;
- default probability;
- sort order;
- open or terminal classification;
- Won, Lost, or no terminal outcome;
- optional or required behavior;
- active state.

Probability is a configurable forecasting default. A permitted user may override it for one Opportunity without changing the stage template. Stage movement must not silently overwrite a reviewed Opportunity-specific probability.

Recommended default B2B sales stages:

| Order | Stage | Reportable milestone and exit criteria | Default probability |
|---:|---|---|---:|
| 1 | Lead Identified | Potential customer fits the agreed ideal customer profile. | 2% |
| 2 | Qualified Lead | Need is validated, the decision-maker or authority and commercial path are identified, and timing is understood. A tenant may require full budget, authority, need, and timeline confirmation. | 10% |
| 3 | Discovery Complete | Business requirements, constraints, stakeholders, and desired outcomes are understood and recorded. | 20% |
| 4 | Solution Fit Validated | Customer agrees that the proposed solution addresses the recorded requirements. | 35% |
| 5 | Demonstration / Proof of Concept | Required demonstration, pilot, or proof step is completed successfully. This stage may be optional for Funnels that do not require it. | 50% |
| 6 | Proposal Submitted | Commercial proposal is delivered to the customer and receipt is recorded. | 65% |
| 7 | Negotiation | Pricing, legal, security, procurement, or contract terms are actively being resolved. | 80% |
| 8 | Verbal Commitment | Customer indicates intent to purchase, subject to final execution. This is not Closed Won. | 95% |
| Terminal | Closed Won | Contract, accepted order, or other tenant-defined binding purchase event is completed. | 100% |
| Terminal | Closed Lost | Opportunity is closed without purchase and a loss reason is recorded. | 0% |

Closed Won and Closed Lost are terminal outcomes, not two sequential steps. Closed Lost may be selected from any open stage. A Nurture or Paused disposition is not automatically Closed Lost and may retain a re-entry date.

### 6.6 Opportunity stage history

Records every stage change with:

- Opportunity;
- previous and next stage;
- changed by;
- changed at;
- milestone evidence;
- probability before and after;
- reason or note;
- next action;
- loss reason when entering Closed Lost.

Stage changes must be reportable and auditable. A milestone date is derived from history rather than inferred only from the current stage.

### 6.7 Asset requirement

A Funnel-owned declaration that a stage requires an asset. It is not the asset itself.

Required fields:

- funnel and stage;
- asset type;
- purpose;
- required or optional;
- audience;
- offer;
- channel;
- success intent;
- owner;
- due date;
- fulfillment status;
- linked Cookbook request;
- linked approved asset version.

Suggested fulfillment states:

- Not requested;
- Requested;
- In production;
- In review;
- Changes requested;
- Approved;
- Linked;
- Blocked;
- Not required.

### 6.8 Stage asset link

Links a Funnel stage and asset requirement to one specific approved Cookbook asset version.

An active Funnel continues using that version until an authorized user accepts a replacement. Cookbook revisions never silently alter an active Funnel.

### 6.9 Funnel task link

References a shared BOH project or task and records the originating Funnel and stage.

### 6.10 Readiness check

A derived or reviewed result covering:

- required stages present;
- conversion objective defined;
- owner assigned;
- required assets fulfilled by approved versions;
- required operational tasks complete;
- dates and launch state valid;
- approvals complete.

### 6.11 Performance observation

A tenant-scoped finding connected to a Funnel or stage.

The first release supports manual or imported summaries. Later phases may add connected metrics and diagnostics.

### 6.12 Revision request

A controlled request for Cookbook to revise or adapt an asset based on a stage requirement or performance observation.

### 6.13 Asset Pack requirement

A Funnel may request a Cookbook Asset Pack when one customer journey needs several coordinated outputs.

For a lead magnet Funnel, the pack may contain:

- downloadable guide or workbook;
- landing page;
- delivery or confirmation page;
- cover and supporting images;
- delivery email;
- nurture or follow-up sequence;
- social or ad variants;
- approved source and build bundles.

Each Funnel stage links only the approved versions it uses. The pack remains canonical in Cookbook, and Funnel readiness is derived from the required version links.

Web asset requirements may show an authorized preview, validation result, and approved version. Funnel does not own the file workspace, source tree, build process, or browser preview runtime.

## 7. Information architecture

Primary navigation:

```text
Funnel
  Overview
  Journeys
  Pipeline
  Assets
  Tasks
  Performance
```

### 7.1 Overview

Shows:

- active and planned funnels;
- readiness and blocker counts;
- missing asset requirements;
- upcoming launches;
- recently changed funnels;
- stage or task items requiring attention.

### 7.2 Journey workspace

Use a bounded master-detail layout.

Left pane:

- funnel list;
- search;
- status, owner, audience, offer, and date filters.

Centre pane:

- selected funnel goal;
- ordered stages;
- stage dependencies and optional branches;
- asset requirement state;
- owner and readiness indicators.

Right drawer:

- selected stage details;
- assigned audience and offer;
- entry and completion conditions;
- required assets;
- linked tasks;
- approval evidence;
- performance observations;
- version and audit history.

A visual journey view may be offered as an additional view, but the structured stage list remains the operational source of truth.

### 7.3 Pipeline

Shows Funnel-owned Opportunities grouped by the reportable sales stages. Each card or row shows:

- Opportunity and linked Patron organisation or people;
- owner;
- value and currency;
- current stage;
- default or overridden probability;
- expected close date;
- next action and due date;
- age in stage;
- milestone or blocker state.

The Pipeline supports stage movement only when required exit criteria and evidence are satisfied or an authorized exception is recorded. It provides weighted forecast, stage counts, values, conversion, velocity, Won, Lost, and loss-reason reporting.

Patron relationship details open from the Opportunity without transferring Pipeline ownership back to Patron.

### 7.4 Assets

Shows asset requirements grouped by stage and their Cookbook fulfillment state. Users can request a new Cookbook asset, link an existing approved asset, preview the linked version, or request a controlled revision.

### 7.5 Tasks

Shows shared BOH tasks linked to the Funnel, stage, request, or launch. Every task shows its source record and owning product.

### 7.6 Performance

Shows stage and Funnel observations, linked metrics where available, and revision opportunities. It does not create a second analytics source of truth.

## 8. Primary workflows

### 8.1 Create a Funnel

1. Select the business or brand.
2. Select or create the audience in the shared BOH source of truth.
3. Select or create the offer in the shared BOH source of truth.
4. Define the measurable conversion objective.
5. Start from a goal-based template or a blank Funnel.
6. Add and order stages.
7. Define stage outcomes and required assets.
8. Assign owners and dates.
9. Review readiness.

### 8.2 Request an asset from Cookbook

1. Open a Funnel stage.
2. Add or select an asset requirement.
3. Confirm purpose, audience, offer, channel, due date, and success intent.
4. Select an existing approved asset or choose Request from Cookbook.
5. Funnel creates a structured request.
6. Cookbook owns production and status.
7. Funnel displays the returned status without copying the asset workflow.

### 8.3 Fulfill an asset requirement

1. Cookbook completes its recipe, review, and approval workflow.
2. Cookbook returns an approved asset version.
3. Funnel links that exact version to the requirement.
4. Readiness recalculates from the approval evidence.
5. The stage records who accepted the linked version and when.

### 8.4 Revise an active asset

1. A user records a performance observation or requested change.
2. Funnel creates a revision request linked to the current asset version.
3. Cookbook creates a new draft and version lineage.
4. The current active Funnel remains unchanged.
5. An authorized user reviews and accepts the replacement version.
6. Funnel records the version change in audit history.

### 8.5 Launch review

1. Review Funnel goal, dates, and owners.
2. Confirm required stages.
3. Confirm all required assets have approved linked versions.
4. Confirm required tasks and approvals.
5. Resolve blockers or record an approved exception.
6. Mark Ready to launch.
7. Activate through an authorized launch action or connected service.

### 8.6 Create an Opportunity

1. Select the Funnel.
2. Link the relevant Patron organisation and people.
3. Record value, currency, owner, source, expected close date, and next action.
4. Confirm that the lead fits the required entry criteria.
5. Place the Opportunity in Lead Identified.
6. Record stage history and the initial milestone date.

### 8.7 Move an Opportunity

1. Open the Opportunity.
2. Review the next stage's exit criteria.
3. Add required milestone evidence and next action.
4. Confirm the stage probability or record an authorized Opportunity-specific override.
5. Move the Opportunity.
6. Save the previous and next stage, actor, time, evidence, probability, and next action in stage history.

### 8.8 Close an Opportunity

Closed Won requires the tenant-defined binding purchase event and value confirmation.

Closed Lost requires a loss reason and optional competitor, notes, re-entry eligibility, and follow-up date. Closed Lost is available from any open stage and is not a sequential stage after Closed Won.

## 9. Cookbook handoff contract

Every Funnel asset request must include:

- tenant;
- Funnel;
- stage;
- requirement id;
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
- current asset version when requesting a revision.

Cookbook returns:

- asset id;
- approved asset version id;
- status;
- owner and approver;
- approval timestamp;
- preview or safe access reference;
- channel and format metadata;
- version lineage.

## 10. Onboarding and activation

Funnel onboarding is outcome-based and skippable.

### Funnel starter

1. Choose the first Funnel goal.
2. Select the audience.
3. Select the offer.
4. Define the conversion objective.
5. Add or confirm stages.
6. Identify required assets.
7. Send at least one asset request to Cookbook.
8. Review readiness.

The completed outcome is a usable Funnel plan with visible gaps, not a completed training course.

Contextual guidance explains:

- what a stage is;
- how to choose a conversion objective;
- what belongs in an asset requirement;
- how Funnel and Cookbook remain separate;
- how readiness is derived;
- how approved asset versions are replaced safely.

## 11. Permissions and governance

1. Every Funnel, Journey stage, Opportunity, Opportunity stage, history event, requirement, link, task reference, observation, and audit event is tenant scoped.
2. App access follows BOH tenant app entitlement and membership.
3. Create, edit, approve, activate, pause, archive, and replace-version actions may have separate permissions.
4. Production launch actions may require approval or re-authentication.
5. Agents can recommend, draft, and prepare requests only within granted capabilities.
6. Agents cannot bypass human launch, asset approval, or production gates.
7. All material status, approval, and version changes are auditable.
8. BOH application ownership uses `public.boh_user.id`, not direct `auth.users.id` comparisons.

## 12. Shared product integrations

### Cookbook

Creates, reviews, versions, and approves assets.

### Patron

Owns people, organisations, relationships, activities, and customer history. Funnel owns Opportunities and sales Pipeline records linked to Patron.

#### Current Patron Pipeline reconciliation

The current BOH-DEV Patron implementation is not yet an Opportunity Pipeline:

- `patron_pipeline_stage` currently contains Lead, Prospect, Qualified, Customer, and Inactive;
- the same table also contains recruiter-specific New Recruiter Intake, Qualified Recruiter, Booked Call, and Nurture Recruiter stages;
- `pipeline_stage_id` is stored directly on Patron people and organisations;
- the current Patron Pipeline page groups people by stage;
- the current stage record has key, label, description, order, and active state, but no exit criteria, probability, terminal outcome, milestone history, value, or forecast behavior.

Required migration direction:

1. Create Funnel-owned Opportunity, Opportunity stage definition, and Opportunity stage history records.
2. Link Opportunities to existing Patron people and organisations.
3. Stop treating a person or organisation as if it can have only one sales stage.
4. Replace the current five generic sales labels with the governed Funnel stage template where appropriate.
5. Move recruiter intake and booking states into a specific recruiter acquisition Funnel or the recruiter intake workflow rather than the global Patron stage list.
6. Preserve Lead, Customer, Inactive, or Nurture only as clearly defined relationship or lifecycle states if Patron still requires them.
7. Keep legacy `pipeline_stage_id` fields read-only or transitional until every current record has an approved mapping.
8. Do not rewrite existing BOH-DEV or production Patron records without a tenant-safe migration, verification, and rollback plan.

### Projects and tasks

Provide shared ownership, assignments, due dates, and work tracking with source provenance.

### Keep

Stores approved files and governed documents where appropriate. Funnel stores references, not duplicate binaries.

### Slotz and Loft

May provide booking, appointment, event, and attendance touchpoints.

### BOH Vault

Stores and delivers protected integration credentials. Funnel does not expose provider secrets.

### Australis

May receive approved commercial work as Work Sessions and return evidence or recommendations. BOH remains the owner of Funnel records and business workflows.

## 13. MVP requirements

The first release must provide:

1. Tenant-scoped Funnel records.
2. Audience and offer references.
3. A measurable conversion objective.
4. Ordered stages with owners and outcomes.
5. Required and optional asset requirements.
6. Structured requests to Cookbook.
7. Links to specific approved Cookbook asset versions.
8. Derived readiness and blocker visibility.
9. Shared task references with source provenance.
10. Draft, review-ready, launch-ready, active, paused, completed, and archived lifecycle states.
11. Audit history for material changes.
12. A bounded master-detail desktop workspace and usable mobile detail sheets.
13. Funnel-owned Opportunities linked to Patron people and organisations.
14. Configurable Opportunity stage definitions with milestones, exit criteria, and default probabilities.
15. The recommended eight open stages plus Closed Won and Closed Lost terminal outcomes.
16. Stage history, age in stage, next action, expected close date, value, probability override, and loss reason.
17. Pipeline counts, values, weighted forecast, conversion, velocity, and outcome reporting.

## 14. Deferred capabilities

Later phases may add:

- visual journey canvas;
- reusable Funnel templates;
- publishing and measurement connectors;
- automatic metric ingestion;
- controlled A/B tests and variant allocation;
- multi-touch attribution;
- performance-based revision suggestions;
- diagnostic scans;
- influencer and partner paths;
- advanced event triggers and branching;
- cross-Funnel asset reuse recommendations;
- approved agent-operated optimization routines.

## 15. Acceptance criteria

The MVP is acceptable when:

1. A permitted user can create a tenant-scoped Funnel with an audience, offer, goal, owner, and ordered stages.
2. Each stage can declare required assets without creating the assets inside Funnel.
3. A user can send a structured requirement to Cookbook.
4. Cookbook status is visible in Funnel.
5. An approved Cookbook asset version can fulfill the requirement.
6. Funnel readiness changes based on linked approval evidence rather than a manual checkbox alone.
7. A Cookbook revision does not silently change the version used by an active Funnel.
8. A permitted user can explicitly accept a replacement asset version with audit evidence.
9. Funnel links Patron context without duplicating Patron records.
10. Every material record and action is tenant scoped and permission checked.
11. Desktop and mobile workflows preserve the selected Funnel or stage context.
12. No production launch or approval gate can be bypassed by an agent.
13. A permitted user can create an Opportunity linked to Patron without adding sales stage fields to a new Patron record.
14. A person or organisation can be linked to more than one Opportunity.
15. A stage movement records milestone evidence and an immutable history event.
16. Closed Lost is reachable from any open stage and requires a loss reason.
17. Verbal Commitment remains open and does not count as Closed Won.
18. Probability defaults are configurable and do not silently replace an authorized Opportunity override.

## 16. Success measures

Track:

- time to first usable Funnel;
- percentage of new tenants that create a Funnel;
- percentage of Funnels with a measurable objective;
- percentage of Funnels with at least one fulfilled asset requirement;
- percentage of required assets linked to approved Cookbook versions;
- time from asset request to approval;
- time from Funnel creation to Ready to launch;
- number of unresolved launch blockers;
- open Pipeline value and weighted forecast;
- conversion rate by Opportunity stage;
- average time and age in stage;
- Won and Lost value;
- loss reasons;
- forecast accuracy;
- percentage of active asset replacements completed through the controlled version workflow;
- onboarding resume and completion rate;
- percentage of work completed through structured workflows rather than assistant-only interactions.

## 17. Source-of-truth rules

1. Funnel owns customer journey structure, sales Opportunities, Opportunity stages, probabilities, milestones, forecasts, outcomes, and readiness.
2. Cookbook owns asset production, approval, and versions.
3. Patron owns people, organisations, relationships, activities, and customer history.
4. Shared BOH context owns business, audience, offer, and voice records.
5. Shared projects and tasks own general work tracking.
6. Keep or the approved asset store owns files; Funnel holds references.
7. BOH Vault owns protected integration values.
8. Australis may act on approved work but does not replace BOH application records.
