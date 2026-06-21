# BOH-DEV Australis identity + Patron bootstrap

BOH-DEV only. Do not run this against production BOH, and do not paste service-role keys or other secret values into chat/logs.

## Decision

- `admin@australis.cloud` should exist in BOH-DEV if Australis work needs a tenant-scoped operator account that can log into BOH to manage Australis Menu / Forge / Counter records. This is the operational/admin BOH identity for Australis work.
- `hello@australis.cloud` may exist in BOH-DEV as a normal/customer-style smoke-test user so we can verify non-admin Australis tenant membership, access boundaries, and Patron visibility. Production rule: do not create BOH auth/users for every Australis platform end user. Only people who actually operate BOH work records need BOH auth and `public.boh_user` rows.

Australis remains its own tenant/customer/vendor entity. It is not a child of JOBZCAFE®.

## Required Auth Admin step first

The bootstrap SQL intentionally does not create fake `auth.users` ids. Before running `02_BOOTSTRAP_AUSTRALIS_BOH_DEV_IDENTITIES.sql`, create or invite the dev auth users in the BOH-DEV Supabase project:

1. Open BOH-DEV Supabase Dashboard > Authentication > Users.
2. Create or invite:
   - `admin@australis.cloud`
   - `hello@australis.cloud` (BOH-DEV smoke-test user only, optional for production)
3. Use BOH-DEV redirect URLs already documented for this repo:
   - `http://localhost:5173`
   - `http://localhost:5173/**`
   - `https://dev-boh.jobzcafe.com`
   - `https://dev-boh.jobzcafe.com/**`
   - `https://boh.australis.cloud`
   - `https://boh.australis.cloud/**`
4. Confirm each user has an `auth.users.id` in BOH-DEV before running the bootstrap.

If using an admin API script instead of the Dashboard, run it only with BOH-DEV env vars loaded locally, never print them, and use the same emails and redirect URLs above.

## Run order

Run these in the BOH-DEV Supabase SQL editor, not production:

1. `01_VERIFY_AUSTRALIS_AUTH_PRECHECK.sql`
   - Confirms the Australis tenant exists.
   - Shows whether BOH-DEV `auth.users` rows exist for the two emails.
   - Shows current BOH / tenant / app / role / Patron state.
2. Create/invite missing Auth users if the precheck says they are missing.
3. `02_BOOTSTRAP_AUSTRALIS_BOH_DEV_IDENTITIES.sql`
   - Creates/updates `boh_user` only when the matching `auth.users` row exists.
   - Adds `boh_tenant_member` rows for the Australis tenant.
   - Enables Australis tenant apps: Menu, Forge, Counter, Patron when those apps exist in `boh_app`.
   - Grants user app access: admin gets Menu/Forge/Counter/Patron; hello gets Menu/Counter/Patron for normal-user BOH-DEV checks.
   - Creates/updates Patron organisation/person rows and links them to Australis where schema supports it.
4. `03_VERIFY_AUSTRALIS_IDENTITY_BOOTSTRAP.sql`
   - Expected final state across Auth, BOH users, tenant membership, role/app assignments, and Patron.

## Expected result

- `admin@australis.cloud`: active Auth user, `boh_user.auth_user_id` linked, Australis tenant member, admin/super-admin-capable role assignment depending on available role codes, Menu/Forge/Counter/Patron access, Patron person linked to the Australis organisation.
- `hello@australis.cloud`: active Auth user if created for BOH-DEV smoke testing, `boh_user.auth_user_id` linked, Australis tenant member, staff/default role assignment, Menu/Counter/Patron access, Patron person linked to the Australis organisation.
- Australis `boh_tenant` remains separate from JOBZCAFE®; do not create parent/child tenant links.
