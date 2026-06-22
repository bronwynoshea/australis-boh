/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SLOTZ_SUPABASE_URL: string
  readonly VITE_SLOTZ_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SLOTZ_SUPABASE_PROJECT_ID: string
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
