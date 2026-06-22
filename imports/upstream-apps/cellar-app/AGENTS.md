# JOBZCAFE Cellar Codex Notes

This repository is for the JOBZCAFE Cellar investor operating system and investor presentation workspace.

## Repo Workflow

- Codex works on `codex-staging`.
- Tested work should move to `staging`.
- Production-ready work should later move from `staging` to `main`.
- The GitHub remote can be connected after the local scaffold is ready.

## Environment Rules

- Development uses BOH-DEV Supabase first.
- Production uses BOH Supabase only after explicit approval.
- All Cellar database objects, Edge Functions, buckets, RPCs, queues, secrets, and app-specific helper names should use the `cellar_` or `CELLAR_` prefix.
- Schema work must be additive-first and represented in migration files before promotion.
- Do not apply migrations or deploy functions to BOH-DEV while another active app is being changed against that project unless explicitly approved.

## Identity And Access

- Supabase Auth users are authentication only.
- BOH staff/admin ownership and audit fields should resolve through `public.boh_user.auth_user_id` and store/compare `public.boh_user.id`.
- Investor MVP access is expected to support secure code/link sessions without mandatory investor account creation.
- Investor-facing retrieval must use the Investor KB only and must not expose unrestricted BOH or Product KB content.

## Product Focus

- Phase one prioritizes the investor-facing presentation workspace.
- The investor side is mobile-first and responsive for desktop.
- Staff/admin surfaces should be minimal until the investor workflow foundation is clear.
- Use the normal JOBZ CAFE BOH login pattern for staff/admin access.
- Use a separate premium access-code experience for investors.
