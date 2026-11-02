// The Supabase client, and nothing else. Queries live with the feature that uses them and take the board
// from BoardProvider. Both variables are public by design: access is controlled by row-level security.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Missing Supabase configuration: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env.local for local development, or in the Netlify environment for a deploy).",
  );
}

export const db = createClient(url, key);
