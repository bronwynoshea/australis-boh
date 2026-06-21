# TICKET-2026-04-26-002: BOH Dashboard Renders Before Login

## Summary
Unauthenticated users could briefly see the BOH dashboard when visiting `/boh` directly. The app redirected to login only after the user tried to interact with protected functionality.

## Type
Bug fix

## Status
Fixed locally pending commit.

## What Was Wrong
The `/boh/*` route rendered `DashboardApp` directly. That route bypassed the older login check inside `renderBohMainUI`, so the dashboard shell could appear before Supabase confirmed whether the user had a valid session.

## Root Cause
The top-level route table had protected BOH routes wired directly to app components:

```tsx
<Route path="/boh/*" element={<DashboardApp isAdmin={isSuperAdmin} />} />
```

The login guard existed in another render path, but `/boh/*` did not use it.

## How It Was Fixed
**File:** `src/App.tsx`

Added an auth-ready state and a shared protected route renderer:

```tsx
const renderProtectedRoute = (element: React.ReactElement) => {
  if (!isAuthReady) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/boh/login" replace />;
  }

  return element;
};
```

Protected BOH routes now wait until the session check finishes. If there is no valid BOH login/session, the user is sent to `/boh/login` before protected screens render.

## Files Changed
1. `src/App.tsx`

## Verification
- `git diff --check` passed for the changed file.
- `npm run build` and `npm run typecheck` could not run in the local shell because `npm` and project `node_modules` were unavailable.

## Deployment Notes
No deployment was performed. This is a frontend source change only.

## Follow-Up Testing
- Visit `/boh` in a fresh logged-out browser session.
- Confirm the login screen is the first screen shown.
- Confirm the dashboard no longer flashes before redirect.
- Log in and confirm `/boh` renders normally.
