# Australis BOH Agent Notes

This repository is for Australis BOH/back-of-house workspace work.

Australis BOH is the Australis-owned path for BOH development. The existing JOBZCAFE® BOH production deployment remains in `bronwynoshea/jobzcafe-boh` and must not be changed from this repo unless explicitly requested.

## Repo Boundaries

- Active repo: `bronwynoshea/australis-boh`
- Local folder: `/home/jobzcafe/australis-boh`
- Source migration reference: `/home/jobzcafe/jobzcafe-boh`
- Related Talent repo: `/home/jobzcafe/talent-app`
- Do not edit the Talent repo or the old JOBZCAFE® BOH repo from this project unless explicitly asked.

## Source Of Truth

Use staging as the reviewed project source of truth.

- Do not treat `main` being ahead as automatically correct.
- Hermes work happens on `hermes-staging` unless the user explicitly asks for another branch.
- Before making code changes, fetch/switch from `origin/staging` or the requested branch and verify branch ancestry.

## BOH Workflow

1. Hermes works on `hermes-staging`.
2. Changes are tested against BOH-DEV Supabase.
3. When good, merge `hermes-staging` into `staging` after review.
4. `staging` becomes the clean tested backup.
5. Production movement is a separate human-reviewed deploy/migration decision.

## Production Safety

- Existing JOBZCAFE® production BOH: `https://boh.jobzcafe.com`.
- Future Australis BOH canonical domain: `https://boh.australis.cloud`.
- Treat `boh.jobzcafe.com` as the current JOBZCAFE® production/white-label surface.
- Treat this repo as BOH-DEV/Australis migration work until explicitly promoted.
- Do not run SQL against production or change production Cloudflare settings from this repo without explicit approval.

## Identity Model

- Supabase Auth users are used for authentication only.
- BOH application ownership, permissions, audit fields, uploads, approvals, and relationships should use `public.boh_user.id`.
- When frontend or Edge Function logic starts from an auth user, resolve it through `boh_user.auth_user_id` and use the BOH user id for app data comparisons and writes.
- Do not compare `auth.users.id` directly to BOH data fields such as `uploaded_by`, `created_by`, `reviewer_id`, or role/app assignment `user_id` columns.

## Dev Supabase Auth URLs

BOH dev auth is configured around the Vite dev port and the Australis Development domain.

- Current JOBZCAFE® production domain: `https://boh.jobzcafe.com`
- Current BOH dev domain: `https://dev-boh.australis.cloud`
- Future Australis BOH domain: `https://boh.australis.cloud`
- Site URL for local dev: `http://localhost:5173`
- Redirect URL: `https://dev-boh.australis.cloud`
- Redirect URL: `https://dev-boh.australis.cloud/**`
- Redirect URL: `https://boh.australis.cloud`
- Redirect URL: `https://boh.australis.cloud/**`
- Redirect URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/**`

Treat these as expected dev/migration auth settings. They may not all be required for every task, but do not remove or assume they are wrong without explicit confirmation.
