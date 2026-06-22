# App consolidation workspace

This repo is becoming the single frontend shell for BOH-backed apps that already share the BOH-DEV Supabase project.

## Imported upstream frontend repos

The initial import keeps upstream app code out of the compiled `src/` tree so the current Australis BOH login/dev server remains stable while we migrate routes deliberately.

| App | Upstream repo | Imported path | Source branch | Source commit | Notes |
| --- | --- | --- | --- | --- | --- |
| Cellar | `bronwynoshea/cellar-app` | `imports/upstream-apps/cellar-app` | `main` | _see `imports/upstream-apps/cellar-app/.import-source.json`_ | Investor/presentation workspace. |
| Slotz | `bronwynoshea/slotz-app` | `imports/upstream-apps/slotz-app` | `main` | _see `imports/upstream-apps/slotz-app/.import-source.json`_ | Booking/scheduling workspace. |
| Loft | `bronwynoshea/loft-app` | `imports/upstream-apps/loft-app` | `main` | _see `imports/upstream-apps/loft-app/.import-source.json`_ | Meeting/personal-room workspace. |

`chatz-app` exists upstream but is intentionally not imported yet because the app has not been built.

## Migration target

Move code from imported snapshots into first-class modules under:

```txt
src/apps/cellar/
src/apps/slotz/
src/apps/loft/
```

Use shared BOH/Australis shell services for:

- Supabase client/env handling
- auth/session resolution
- tenant resolution
- BOH user/app permissions
- shared UI/layout/navigation

Keep app-specific boundaries for routes, services, and component trees. Do not cross-import internals between apps; move genuinely shared code to `src/shared` or `src/boh`.

## Environment/secrets rule

These apps currently share the BOH-DEV Supabase project, but app-specific runtime values should keep clear ownership prefixes where possible (`CELLAR_`, `SLOTZ_`, `LOFT_`). Browser-exposed Vite values still need `VITE_` prefixes and must remain public/publishable only.

Private secrets stay in Supabase/Edge Function/runtime secret stores, not frontend `.env` files.
