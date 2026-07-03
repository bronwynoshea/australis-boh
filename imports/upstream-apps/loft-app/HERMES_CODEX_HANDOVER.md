# Hermes Codex Handover - Loft

Purpose: use this file to recreate the useful Loft context from the current Codex setup on another laptop without copying secrets.

## Read First

1. `.env.example`
2. `README.md`
3. Existing docs in `docs/` if the task touches auth, rooms, or deployment
4. This file

## Repository

- Repo: `bronwynoshea/loft-app`
- Local valid Git checkout used for pushes here: `C:\JOBZCAFE\1. DEVELOPMENT ENVIRONMENT\loft\codex-staging-checkout-shallow`
- BOH-native route: `https://boh.australis.cloud/apps/loft`
- Current working branch in this checkout: `codex-staging`
- Production/staging deployment must not be changed unless the user explicitly asks.

## Setup On Hermes Laptop

```powershell
git clone https://github.com/bronwynoshea/loft-app.git
cd loft-app
npm install
copy .env.example .env.local
npm run dev
```

Fill `.env.local` manually from the secure password manager or deployment provider. Never copy values into chat and never commit `.env`, `.env.local`, Supabase temp files, or secrets.

## Environment Names

Use the newer frontend-safe Supabase names:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_API_BASE_URL
```

Do not add `VITE_SUPABASE_ANON_KEY` just to satisfy old code. If code asks for `VITE_SUPABASE_ANON_KEY`, update the code to use `VITE_SUPABASE_PUBLISHABLE_KEY` instead.

Loft allowed origins are represented by `LOFT_ALLOWED_ORIGINS` for server/Edge Function use. Keep values environment-specific.

## Supabase/Auth Notes

- Use the development Supabase project values for dev/staging.
- Supabase Auth redirect URLs for Loft dev should include:

```text
https://boh.australis.cloud
https://boh.jobzcafe.com
```

Vite env vars are build-time values. After changing Cloudflare Pages variables, redeploy the site.

## Cross-Repo Context

- Loft is a hybrid app: internal BOH/release ownership plus external users who may generate Counter tickets.
- In BOH Counter, Loft tickets should appear under Hybrid audience, but release assignment should use external release values.
- BOH ticket/release work belongs in `jobzcafe-boh`; Loft app implementation belongs here.

## Useful Commands

```powershell
npm run dev
npm run build
npm run preview
```

## Codex Operating Notes

- Prefer small focused changes.
- Do not print secrets.
- Keep deployment/env fixes separate from product UI changes.
- If Git reports dubious ownership on a new laptop, fix Git safe-directory locally instead of changing repo files.
