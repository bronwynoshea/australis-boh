# Australis rollout Kanban plan

Status: rollout start draft  
Scope: BOH Menu → Forge rollout for Australis entity building Australis platform + BOH  
Date: 2026-06-25

## Purpose

Start the rollout without confusing product/runtime boundaries.

Australis entity operates two product lines:

1. Australis platform — agentic workspace for managing AI agents and producing outputs.
2. BOH / Back of House — operational app suite for business back-office functions.

Australis uses BOH + Australis internally to become an autonomous business unit that can develop, maintain, market, sell, and support both products with minimal human intervention.

## Correct source-of-truth boundaries

- BOH Menu owns rollout initiatives and user stories for building Australis/BOH.
- BOH Forge owns accepted workstreams, execution planning, release readiness, and human-gated delivery.
- BOH Patron/CRM/billing owns Australis/BOH customer accounts, Stripe subscriptions, and entitlements, including Australis-only licenses.
- Australis Supabase owns Australis platform runtime: tenants, users, onboarding, goals, briefings, Work Sessions, agents, model policies, Context Graph, and 3D Workroom runtime data.
- JOBZCAFE® product end customers are irrelevant to Australis/BOH platform runtime and billing except when JOBZCAFE® the business uses BOH Patron/CRM/marketing campaigns for its own prospects/customers.

## Bootstrap users

- `admin@australis.cloud`: existing/first Australis entity platform admin for setup, configuration, and build access.
- `hello@australis.cloud`: first normal/business-manager Australis user after onboarding foundation is ready. This user should operate the Australis autonomous business unit.
- JOBZCAFE® the business: first official non-Australis customer/business using both Australis + BOH to run its software business.

## Recommended Kanban lanes

Use existing Menu/Forge concepts where possible:

```text
Menu Draft
Menu Ready
Submitted to Forge
Accepted by Forge
Forge Workstream Ready
In Progress
Blocked
Review
Done
```

## Initial Menu initiatives

### 1. Bootstrap Australis autonomous business foundation

Goal: confirm BOH Australis entity tenant, admin user, entitlement/billing boundary, and minimum Australis platform foundation needed before `hello@australis.cloud` can onboard.

Push to Forge first.

User stories:

- As the Australis platform admin, `admin@australis.cloud` can access the Australis entity operating context and manage setup safely.
- As the Australis business, we have a BOH-owned billing/CRM/entitlement model for Australis-only, BOH-only, and bundle customers.
- As the first business-manager user, `hello@australis.cloud` has a defined onboarding path that creates a real Australis tenant/workspace/profile/membership/access state.
- As the platform team, we can prove JOBZCAFE® product end-customer billing/runtime is out of scope for Australis/BOH customer billing.

Acceptance criteria:

- BOH Australis entity/business tenant confirmed.
- `admin@australis.cloud` access confirmed.
- `hello@australis.cloud` onboarding path defined.
- Australis Supabase target/environment confirmed.
- BOH billing/Patron/entitlement ownership documented.
- First Forge workstream created only for bootstrap/platform foundation.

### 2. Australis onboarding and human profile foundation

Goal: build enough onboarding that `hello@australis.cloud` can become the first normal Australis business-manager user.

User stories:

- As `hello@australis.cloud`, I can complete onboarding with role, goals, communication style, working style, briefing preferences, source permissions, and voice/text response settings.
- As the Australis business manager, I can define annual, six-month, and 90-day goals so agents understand business priorities.
- As a tenant owner, I can choose operating mode: standalone Australis, connected BOH, or connected external work platform.

### 3. BOH billing, Patron CRM, and entitlement foundation

Goal: make BOH the source of truth for Australis/BOH customers, billing, Stripe subscriptions, and product entitlements.

User stories:

- As Australis commercial operations, I can create a Patron/customer account for an Australis/BOH prospect or customer.
- As billing operations, I can represent Australis-only, BOH-only, and Australis+BOH package entitlements in BOH.
- As Australis runtime, I can consume a local entitlement snapshot from BOH to allow/deny access.

### 4. Daily Briefing and Work Sessions foundation

Goal: create core operating layer for daily goal-aware recommendations and structured agent execution.

User stories:

- As a user, I receive a 2:00am local-time Daily Briefing with top three goal-moving recommendations.
- As a user, I can convert a briefing item into a task/work request without automatic task creation.
- As a user/agent, I can see Work Sessions with objective, status, evidence, blockers, approvals, model usage, and outputs.

### 5. Australis Voice, chat, and Hermes model routing

Goal: make voice/chat a real work interface, with local model support and escalation to stronger models where policy allows.

User stories:

- As a user, I can choose text, voice, voice+text, or ask-each-time response mode.
- As a user, I can use contextual voice in a page/workflow or standalone Australis Advisor chat.
- As a tenant/admin, local/private models can handle low-risk tasks and escalate with approval when stronger reasoning is needed.

### 6. BOH adapters and future Australis agent orchestration

Goal: connect Australis to BOH operating sources while keeping product runtimes separate, then prepare for future Australis agents after `hello@australis.cloud` onboarding.

User stories:

- As the future Australis business-manager/product agent, I can review Menu initiatives, user stories, Forge workstreams, ready tasks/jobs, Counter tickets, and product Table/Chair work.
- As the future Australis business-manager/product agent, I can assign suitable work to Australis agents/sub-agents subject to governance rules after those agents exist.
- As Forge Master, I can receive agent outputs/evidence back from the future Australis business-manager/product agent and complete/review work without losing human release gates.

### 7. 3D Workroom and Context Graph foundation

Goal: establish enterprise visualization and governed memory foundations after core work/session data exists.

User stories:

- As a user, I can see humans, agents, Tables, Chairs, Work Sessions, blockers, approvals, and outputs in the 3D Workroom.
- As a user/agent, I can query the Context Graph for goals, decisions, briefings, documents, tasks, Work Sessions, and approved memories.
- As an admin, memory/context is permission-aware, source-linked, auditable, and reviewable.

### 8. Commercial pipeline, Cookbook, Funnel, and marketing asset loop

Goal: enable the autonomous Australis business unit to market and sell Australis/BOH.

User stories:

- As commercial operations, I can use Patron/Funnel to manage Australis/BOH prospects and sales pipeline.
- As marketing operations, I can use Cookbook to create marketing assets for sales funnels and campaigns.
- As the Daily Briefing/commercial agents, I can surface funnel blockers, asset readiness, and campaign next steps after Australis agents exist.

## Forge sequencing recommendation

Push only Initiative 1 to Forge first.

Keep Initiatives 2–8 in Menu until Initiative 1 confirms bootstrap foundations. Then push in this order:

1. Onboarding/human profile foundation.
2. BOH billing/Patron entitlement foundation.
3. Daily Briefing + Work Sessions.
4. Voice/chat + model routing.
5. BOH adapters + future Australis agent orchestration.
6. Commercial pipeline/Cookbook/Funnel.
7. 3D Workroom + Context Graph.

## Agent readiness and assignment recommendation

Australis does not yet have its own agent team. Do not assign Australis rollout work to named Australis agents until the onboarding foundation exists and `hello@australis.cloud` has been onboarded as the first normal/business-manager user.

Rocket is JOBZCAFE®'s Head of Product agent, not Australis's product lead agent. Do not use Rocket as the Australis product owner/orchestrator.

Interim rollout execution should be human/Hermes-assisted through BOH Menu and Forge:

- Menu holds initiatives and user stories.
- Forge holds the bootstrap workstream and execution tasks.
- Humans/Hermes perform implementation until Australis can create its own agents.
- After `hello@australis.cloud` onboarding, create the Australis business-manager/product agent and supporting agents.

Future Australis agents to create after onboarding foundation:

- Australis business-manager/product agent: reviews Menu/Forge/Counter work and coordinates assignment.
- Coding/build agents: implement scoped Australis/BOH code tasks after Forge Master marks work ready.
- QA/testing agent: validates onboarding, entitlement, briefing, voice, and Work Session flows.
- Commercial/growth agent: prepares Cookbook/Funnel/Patron workflows after bootstrap.
- Reviewer agent: checks evidence, boundary compliance, tenant isolation, and no JOBZCAFE® product-customer leakage.

## Rollout guardrails

- Do not touch production Supabase without explicit approval.
- BOH owns Australis/BOH customer billing and entitlements.
- Australis runtime stores only local entitlement snapshots, not Stripe truth.
- Do not use JOBZCAFE® product customer tables as Australis/BOH billing source.
- Do not push all enterprise features into Forge at once.
- Do not allow future Australis agents or sub-agents to bypass human release/production gates.
