# Loft BOH-DEV migration handoff

Date: 2026-06-21
Task: t_6541f27d

This handoff records the BOH-side Loft implementation changes made after the inventory in `docs/plans/loft-boh-dev-migration-inventory.md`.

No secret values were read, copied, printed, or deployed. No production Supabase project was inspected or targeted.

## Implemented in BOH source

- BOH navigation now treats Loft as an internal BOH module at `/loft` rather than an external `dev-loft` / `retired standalone Loft hostname` launch.
- The BOH dashboard routes Loft internally and places it with BOH internal apps instead of hybrid/external apps.
- `/loft` now renders a functional BOH Loft module shell around the existing BOH Loft Edge Functions:
  - prepare/reuse a Personal Room through `loft-get-or-create-personal-room`
  - open the host room and issue a Daily token through `loft-join-token`
  - display Personal Room IDs, invite code, Daily room name, and BOH join route
  - load and moderate waitlist entries through existing waitlist functions
- `/loft/join/:slug` is an unauthenticated public guest route outside protected `/loft/*`, resolving the inventory conflict where guest joins were impossible behind the BOH login guard.
- Added typed Loft API wrappers and response types under `src/apps/loft/`.

## BOH-DEV schema artifact

Added additive migration:

- `supabase/migrations/20260621_add_loft_boh_dev_schema.sql`

It creates or updates the BOH-dev objects referenced by the existing BOH Loft functions:

- legacy `public.profile` Loft transition columns
- `public.loft_room`
- `public.loft_room_member`
- `public.loft_room_waitlist`
- `public.loft_room_join_logs`
- `public.loft_room_rsvp`
- `public.loft_question`
- BOH app registry row for Loft as an internal `/loft` app

Important identity note: this migration intentionally preserves the existing profile-based Loft function contract as a transition boundary. AGENTS.md says BOH app data should ultimately use `public.boh_user.id`; that should be a later reviewed migration once the canonical standalone Loft repo/schema is confirmed.

## BOH-DEV secret/env variable names required

Existing BOH Loft functions require these variable names in BOH-DEV Supabase Edge Function secrets/runtime:

- `SUPABASE_URL`
- `SB_SECRET_KEY`
- `SUPABASE_ANON_KEY`
- `DAILY_API_KEY`

Frontend/local Vite still requires:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Source-only Studio names should not be carried forward unless a deliberate compatibility shim is approved:

- `STUDIO_APP_URL`
- `STUDIO_SUPABASE_ADMIN_KEY`
- `STUDIO_SUPABASE_PUBLISHABLE_KEY`
- `BOH Loft internal route /apps/loft`

## Human BOH-DEV apply/deploy checklist

Use BOH-DEV only; do not point these commands at BOH production.

```bash
cd /home/jobzcafe/jobzcafe-boh
supabase link --project-ref <BOH_DEV_PROJECT_REF>
supabase db push --project-ref <BOH_DEV_PROJECT_REF>
supabase secrets set \
  SB_SECRET_KEY=<boh-dev-service-role-or-secret-key> \
  SUPABASE_ANON_KEY=<boh-dev-anon-or-publishable-key> \
  DAILY_API_KEY=<daily-api-key>
supabase functions deploy loft-get-or-create-personal-room --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-join-token --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-join-personal-room-by-slug --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-get-personal-room-waitlist --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-approve-waitlist-entry --project-ref <BOH_DEV_PROJECT_REF>
supabase functions deploy loft-reject-waitlist-entry --project-ref <BOH_DEV_PROJECT_REF>
```

## Remaining known gaps

- The complete standalone Loft frontend/source repo was not located in this task. The current BOH UI consumes the existing BOH functions and does not attempt to recreate the full Daily call experience.
- The UI intentionally does not print Daily tokens. The next frontend step is wiring an approved Daily call component/embed to consume the returned token and room name.
- Existing waitlist functions do not currently perform host authorization checks; because they use `SB_SECRET_KEY`, tighten authorization before broad production exposure.
- `loft-get-personal-room-by-slug` still has verbose logging/detail behavior noted by the inventory; the new public route uses `loft-join-personal-room-by-slug` instead.
