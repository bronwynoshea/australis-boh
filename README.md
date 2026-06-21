# Australis BOH

Australis BOH is the BOH operating workspace for the Australis platform.

This repository is the new Australis-owned BOH codebase, migrated from `bronwynoshea/jobzcafe-boh` so the existing JOBZCAFE® BOH production deployment can remain untouched while Australis BOH moves forward separately.

## Current deployment model

- Canonical future BOH domain: `https://boh.australis.cloud`
- Current JOBZCAFE® production BOH remains separate: `https://boh.jobzcafe.com`
- Dev/staging work for this repo targets BOH-DEV Supabase unless explicitly approved otherwise.
- Do not point this repo at BOH production or change the existing `jobzcafe-boh` deployment during migration work.

## Branches

- `main`: protected/stable baseline
- `staging`: reviewed staging baseline
- `hermes-staging`: Hermes working branch for migration and verification

## Run locally

Prerequisites: Node.js/npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` from the secure password manager or deployment provider. Never commit `.env`, `.env.local`, or `supabase/.temp` files.

## Checks

```bash
npm run typecheck
npm run build
```
