# Reusable Codex Workflow Skills Plan

This document captures two reusable Codex skills that should be created for SLOTZ, BOH, JOBZCAFE, and future related projects.

These are intentionally generic skills. SLOTZ is the current example project, but the steps should work for any product where we need a careful UI polish pass or a controlled dev-to-prod promotion.

## Skill 1: Enterprise Polish QA

Proposed skill name: `enterprise-polish-qa`

Use this skill when a frontend app needs a screen-by-screen enterprise polish pass, responsive QA, accessibility review, or production readiness sweep.

### Core Workflow

1. Read local project instructions first.
   - Open `AGENTS.md`, project docs, and existing design tokens before changing UI.
   - Preserve product naming and environment guardrails.
   - Do not add silent fallbacks where the project forbids them.

2. Establish the reusable pass tracker.
   - Use the 1-11 sequence below.
   - Mark missing sections as `Not applicable` instead of forcing screens the app does not have.
   - Keep the tracker updated as each section is completed, deferred, or moved into final QA.

3. Work screen by screen.
   - Review the rendered screen in the browser before editing.
   - Fix concrete issues, then verify again.
   - Keep desktop, laptop, tablet, and mobile behavior distinct.
   - Avoid landing-page thinking for operational apps; prioritize dense, calm, repeated-use UI.

4. Standardize visual tokens.
   - Colors come from theme tokens, not one-off hardcoding.
   - Buttons, inputs, cards, notices, borders, shadows, radii, and focus states should share system classes.
   - Avoid browser-default selects, tooltips, controls, and warning colors.
   - Do not use harsh white/black borders unless the design system explicitly calls for them.

5. Messaging rules.
   - Replace native `alert()` and `confirm()` with inline notices or themed modals.
   - Keep success/error/warning placement stable so cards do not jump.
   - Use contextual inline validation for form fields.
   - Reserve strong destructive styling for final destructive confirmation.

6. Responsive QA.
   - Test at desktop, laptop, tablet, and mobile.
   - Check horizontal overflow, clipped CTAs, panel heights, internal scroll areas, sticky headers, footers, and mobile bottom sheets.
   - Use browser measurements as well as screenshots.
   - Laptop may page-scroll where appropriate; desktop should avoid unnecessary page scroll for core work surfaces.

7. Accessibility QA.
   - Check WCAG contrast for theme tokens and rendered text.
   - Ensure visible form fields have labels or accessible names.
   - Ensure icon-only buttons have `aria-label`.
   - Ensure clickable elements are actual buttons or links.
   - Check focus rings, disabled states, modal close actions, and keyboard escape behavior.
   - Verify rendered pages have no visible unlabeled buttons or fields.

8. Production readiness.
   - Remove dev-only UI.
   - Verify no stale product names.
   - Confirm environment names and deployment target.
   - Run build/lint/smoke tests.
   - Document residual risks and deferred items.

### Reusable 1-11 Pass Tracker

Use this exact sequence as the default enterprise polish checklist:

1. Entry / login / onboarding
2. Global visual system
3. App shell / navigation
4. Core workflow / dashboard
5. Settings / admin screens
6. Public / customer-facing pages
7. Integrations UX
8. Feedback / messaging
9. Responsive QA
10. Accessibility pass
11. Production readiness

### Generic Section Mapping

For SLOTZ:

- Entry / login / onboarding = staff login screen.
- Core workflow / dashboard = staff schedule, agenda, manual booking, day/week/month calendar.
- Settings / admin screens = availability, meetings, time off, location, integrations.
- Public / customer-facing pages = booking, manage, reschedule, cancel, confirmation, error states.
- Integrations UX = Outlook and Google Calendar connection, reconnect, disconnect, sync, auth return states.

For BOH:

- Entry / login / onboarding = BOH auth and landing state.
- Core workflow / dashboard = tickets, initiatives, releases, admin console, or operational queue.
- Settings / admin screens = admin configuration and permissions areas.
- Public / customer-facing pages may be `Not applicable` unless the BOH module exposes a public surface.
- Integrations UX = any connected systems, automation, notifications, or external service controls.

For JOBZCAFE / Talent-style products:

- Entry / login / onboarding = candidate, recruiter, or staff sign-in and onboarding.
- Core workflow / dashboard = job search, candidate dashboard, recruiter dashboard, CRM/person workflow, or application flow.
- Settings / admin screens = account, company, profile, notification, billing, or integration settings.
- Public / customer-facing pages = public profiles, jobs, application pages, booking pages, or lead capture.
- Integrations UX = email, calendar, CRM, payment, assessment, or external provider connections.

The skill should adapt the labels to the product, but preserve the order and discipline of the pass.

### Suggested Validation Commands

Use project-specific commands, but start with:

```powershell
rg -n "alert\(|confirm\(|bg-blue|text-blue|border-blue|bg-yellow|text-yellow|bg-orange|text-orange|bg-gray|text-gray|border-gray" src
npm.cmd run build
```

Use browser checks for:

- console errors and warnings
- unlabeled visible buttons
- unlabeled visible inputs/textareas/selects
- horizontal overflow
- clipped focusable controls
- desktop/laptop/tablet/mobile screenshots

## Skill 2: Environment Promotion Runbook

Proposed skill name: `environment-promotion-runbook`

Use this skill when moving code, database changes, secrets, Edge Functions, cron jobs, or frontend builds from a source environment to a target environment, including:

- `boh-dev` to `boh`
- `jobzcafe-dev` to `jobzcafe`
- future paired dev/prod Supabase projects

The skill should be environment-pair driven, using values like `source_env`, `target_env`, `source_project_ref`, `target_project_ref`, `source_domain`, and `target_domain` rather than assuming one fixed project.

### Core Rule

Promotion is not a copy/paste task. Treat it as a controlled release with source-of-truth verification, dry-run checks, explicit environment values, smoke tests, and rollback notes.

### Promotion Workflow

1. Identify source and target.
   - Confirm dev project ref, prod project ref, frontend domain, Edge Function base URL, and branch.
   - Confirm which environment is source of truth.
   - Never assume old project refs are still valid.

2. Inventory changes.
   - Code changes.
   - Supabase migrations.
   - Edge Functions.
   - Function config such as `verify_jwt`.
   - Secrets.
   - Cron SQL.
   - Storage buckets or auth redirect URLs.
   - Any external provider redirect URLs, API keys, or webhook endpoints.

3. Separate environment-specific values.
   - Keep dev/prod project refs explicit.
   - Keep function slugs identical unless project rules say otherwise.
   - Keep environment-specific base URLs isolated.
   - Do not promote localhost URLs into email, OAuth, or public callback paths.

4. Prepare SQL safely.
   - Split SQL into small numbered files.
   - Include `INDEX_DO_NOT_RUN.sql` with run order.
   - Include verify SQL.
   - Keep Dashboard-runnable SQL free of Markdown.
   - Avoid destructive table or policy changes without an explicit rollback plan.

5. Deploy code and functions.
   - Build locally first.
   - Deploy Edge Functions with the correct target project.
   - Confirm function slugs, JWT settings, and secrets.
   - Confirm frontend env variables.
   - Deploy frontend only after backend smoke checks pass where practical.

6. Run smoke tests in target.
   - Login/auth.
   - Public booking.
   - Manage link lookup.
   - Reschedule path.
   - Cancel path.
   - Calendar sync.
   - Email/reminder delivery.
   - CRM/person creation if applicable.
   - Integration reconnect/disconnect/sync states.

7. Verify production data paths.
   - No silent fallbacks.
   - RLS/service-role paths behave as intended.
   - Edge Function failures surface visibly.
   - Logs do not expose secrets.
   - OAuth screens show expected app branding or known provider limitations.

8. Document release outcome.
   - What was promoted.
   - What was verified.
   - What was not verified.
   - Known risks.
   - Rollback notes.
   - Follow-up tickets or deferred migrations.

### Promotion Safety Checklist

- Confirm target before every deploy command.
- Confirm secrets exist but do not print secret values.
- Confirm OAuth redirect URLs in providers before testing.
- Confirm no localhost URLs in production-facing config.
- Confirm no stale product names.
- Confirm no accidental cross-project deployment.
- Keep dev/prod SQL and function slugs traceable.

### Suggested Skill Resources

The eventual skill should include:

- `references/supabase-promotion.md`
- `references/frontend-promotion.md`
- `references/oauth-and-secrets.md`
- `references/smoke-test-template.md`
- optional scripts to inspect env files and search for localhost/stale project refs/product names
