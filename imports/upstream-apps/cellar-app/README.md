# JOBZCAFE Cellar

Cellar is the JOBZCAFE investor operating system and investor presentation workspace.

The first local phase is setup only:

- React + Vite + TypeScript frontend scaffold.
- Tailwind design foundation.
- Supabase client wiring through environment variables.
- Placeholder Supabase structure for future migrations and Edge Functions.
- No BOH-DEV or BOH database changes yet.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` when you are ready to connect to BOH-DEV.

## Branch Workflow

Local development starts on `codex-staging`. Once the GitHub repository exists, connect `origin` and push `codex-staging` first.
