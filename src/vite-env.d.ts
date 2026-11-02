/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Google Analytics 4 measurement id (G-...). Unset: no analytics. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}
