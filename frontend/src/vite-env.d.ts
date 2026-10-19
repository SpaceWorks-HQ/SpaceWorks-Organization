/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_BULK_DAILY_LIMIT?: string;
  readonly VITE_BULK_MAX_QUEUE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
