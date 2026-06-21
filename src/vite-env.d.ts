/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_CELLAR_APP_URL?: string;
  readonly VITE_CELLAR_BOH_HANDOFF_FUNCTION_URL?: string;
  readonly VITE_SLOTZ_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}



