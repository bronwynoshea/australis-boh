# Hermes Handover - Australis BOH

Purpose: recreate useful context for Australis BOH work without copying secrets.

## Read First

1. `AGENTS.md`
2. `.env.example`
3. This file
4. Current branch history and open worktree status after cloning

## Repository

- Repo: `bronwynoshea/australis-boh`
- Local folder used here: `/home/jobzcafe/australis-boh`
- Working branch for Hermes migration work: `hermes-staging`
- Source repo migrated from: `bronwynoshea/jobzcafe-boh`
- Source local reference: `/home/jobzcafe/jobzcafe-boh`
- Existing JOBZCAFE® BOH production branch/domain must remain untouched unless explicitly requested.
- Current JOBZCAFE® BOH production domain: `boh.jobzcafe.com`
- Current BOH dev domain: `dev-boh.australis.cloud`
- Future Australis BOH canonical domain: `boh.australis.cloud`

## Setup On Hermes Laptop

```bash
git clone https://github.com/bronwynoshea/australis-boh.git
cd australis-boh
git checkout hermes-staging
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` manually from the secure password manager or deployment provider. Never copy values into chat and never commit `.env`, `.env.local`, or `supabase/.temp` files.

## Environment Names

Frontend-safe Vite variables used by BOH include:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_BOH_SUPABASE_URL
VITE_COUNTER_BASE_URL
```

Server/control-plane variables in `.env.example` are not browser secrets. Use the example file only for names, not values.

## Supabase Projects

- BOH-DEV project ref: `lczzeiqmnegyjrwtgmsj`
- JobzCafe/Talent shared dev project ref: `jmjrgthqnrebzflythvj`

Use BOH-DEV for Australis BOH verification unless the user explicitly asks for production work. Do not run SQL against production from a Hermes/Codex thread unless explicitly approved.

## BOH Identity Rule

Use `public.boh_user.id` for BOH ownership, assignment, audit fields, approvals, uploads, and role/app relationships. Supabase Auth user ids are authentication-only and should be resolved through `boh_user.auth_user_id` before comparing or writing BOH app data.

## Current Cross-Repo Context

- Australis BOH holds Counter, Forge/release management, internal app navigation, and BOH operational tooling for the Australis-owned BOH path.
- JOBZCAFE® is the first/customer tenant and can keep using `boh.jobzcafe.com` as a white-label/current production surface.
- Talent and JobzCafe app repos are separate. Do not edit those from this repo unless the user explicitly asks.
- Hybrid/shared capabilities such as Loft, Chatz, Slotz, and Counter can create tickets from internal and external surfaces. Keep backend and deploy movement separate by product boundary.

## Useful Commands

```bash
npm run dev
npm run typecheck
npm run build
```

Typecheck may reveal pre-existing archive or missing-module issues inherited from the source repo. Record exactly what fails rather than hiding it.

## Operating Notes

- Keep unrelated dirty work out of commits.
- Hermes uses `hermes-staging` unless the user asks otherwise.
- Prefer existing BOH components such as `BohSelect`, `BohSlideOver`, date/calendar components, and BOH scrollbar utilities.
- Never print secrets.
