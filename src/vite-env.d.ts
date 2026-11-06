/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Better Stack application token (public, from its Frontend tab). Unset: no analytics. */
  readonly VITE_BETTERSTACK_TOKEN?: string;
  /** Where the landing page's Sign in link goes. Unset: the site's own root. */
  readonly VITE_APP_URL?: string;
}
