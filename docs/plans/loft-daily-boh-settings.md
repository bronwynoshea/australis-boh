# Daily settings for BOH-native Loft

Daily dashboard/domain settings should no longer point at standalone `retired standalone Loft hostname` or the old JOBZCAFE® app Supabase project.

Use these BOH-native values:

- Redirect on exit: `https://boh.australis.cloud/daily-redirect`
  - Local/dev-safe alternatives implemented in the app:
    - `/daily-redirect` public route
    - `/apps/loft/daily-redirect` inside the Loft shell
- Meeting join hook: `https://lczzeiqmnegyjrwtgmsj.functions.supabase.co/loft-daily-join-hook`

The BOH `loft-daily-join-hook` Edge Function is deployed and smoke-tested with an unauthenticated POST returning HTTP 200.

Confirmed BOH-DEV secrets now include:

- `DAILY_API_KEY`
- `DAILY_DOMAIN` = `jobzcafe.daily.co`

Frontend/local builds use:

```bash
VITE_DAILY_DOMAIN=jobzcafe.daily.co
```

If the Daily API key ever needs to be rotated, update BOH-DEV with:

```bash
npx supabase secrets set DAILY_API_KEY=*** --project-ref gsidwiptqkyciexqdbyw
```
