/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Better Stack application token (public, from its Frontend tab). Unset: no analytics. */
  readonly VITE_BETTERSTACK_TOKEN?: string;
}
