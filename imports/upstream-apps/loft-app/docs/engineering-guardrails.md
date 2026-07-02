# Loft Engineering Guardrails

## JOBZCAFE® Brand Mark

Use the registered mark whenever the JOBZCAFE® brand appears in user-facing copy or product documentation.

- Use `JOBZCAFE®` for the compact brand name.
- Use `JOBZ CAFE®` only where the spaced brand form is intentionally required.
- Do not add the registered mark inside domains, email addresses, code identifiers, environment names, storage keys, file paths, or database names.

## No Silent Fallbacks

Do not hide configuration, auth, backend, permission, or data-shape problems with silent fallback values.

Bad examples:

- Falling back from a missing Supabase URL/key to a hardcoded project.
- Falling back from a failed permission check to an empty list without surfacing the error.
- Falling back from missing role/access data to a broader default access path.
- Falling back from a missing required room/table field to fake production data.
- Falling back from an unrecognized browser origin to any production or staging domain in Edge Function CORS.

Allowed examples:

- UI-only placeholder text while data is loading.
- Empty-state copy after a successful query returns no records.
- Defensive rendering for optional display-only fields, such as missing avatar images.

If required configuration or data is missing, fail loudly with a clear error so the issue can be fixed at the source.

For Loft Edge Functions, CORS must be driven by the explicit `LOFT_ALLOWED_ORIGINS` environment variable. Do not hardcode `loft.jobzcafe.com`, `dev-loft.jobzcafe.com`, localhost, or any fallback origin in function source.

## Personal Room Links

Keep host/member access and external participant access separate.

- Member/host access uses the authenticated Personal Room route and the member profile context.
- External participants use a guest invite identifier owned by the Loft room/session, currently `loft_room.invite_code`.
- Do not use `profile.personal_room_slug` as the primary guest link unless it is an intentional legacy compatibility path.
- Slotz integrations should attach bookings/appointments to a Loft room/session and its guest invite identifier, not to the host's member slug alone.

## Vite and Cloudflare Environment Variables

For JOBZCAFE® Vite apps deployed on Cloudflare Pages, client code must read build-time environment variables through direct `import.meta.env.VITE_*` access.

- Use `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do not use `VITE_SUPABASE_ANON_KEY` in Loft or new JOBZCAFE® apps.
- Do not read required Vite variables through `(import.meta as any).env`; this can prevent Vite from replacing values correctly in Cloudflare-built bundles.
- Do not add hardcoded fallback Supabase URLs, API URLs, origins, or key aliases.
- Missing required Vite variables should stop the app with a clear error, so Cloudflare project settings can be corrected.
- Keep `npm run build` wired to `scripts/check-vite-env.cjs` so Cloudflare fails before publishing a bundle that would crash at runtime.

The Supabase publishable key is expected to be present in browser bundles. Security must come from Supabase Auth, RLS, scoped Edge Functions, and never exposing service-role secrets.

## Edge Function Auth

When touching an existing Loft Edge Function, migrate it away from legacy JWT assumptions.

- Do not require a legacy JWT just because the function previously did.
- Public invite and pre-login functions must be explicitly deployed/configured as public-safe functions.
- Public-safe functions may return only the minimum invite or lookup metadata needed before login, never Daily tokens, secrets, privileged profile data, or broad table data.
- Authenticated functions must validate the current Supabase session or service-side permission checks intentionally.
- Record any Edge Function auth-boundary change in the Loft change ledger.

## Interaction Surfaces

For focused Loft account and settings surfaces, use a desktop side drawer and a mobile bottom sheet.

- Desktop drawers should be full-height side panels, not centered modals.
- Mobile sheets should come from the bottom and keep the underlying app context intact.
- Do not turn small account edits into full pages unless the workflow genuinely needs a full page.
