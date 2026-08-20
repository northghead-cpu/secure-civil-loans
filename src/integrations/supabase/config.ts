const CANONICAL_SUPABASE_URL = "https://zdpeaxkormwjrgllwalq.supabase.co";

// This is a publishable client key, not a service-role secret. The browser
// must receive a publishable/anon key to initialize Supabase. Deployment
// variables remain the preferred source; the canonical fallback prevents a
// missing Vercel variable from taking the entire React application down.
const CANONICAL_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_dI7oVb0kbFPUu0SNdHWjBQ_L9aXVKcq";

type Env = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export const getSupabaseConfig = (env: Env = import.meta.env) => ({
  url: env.VITE_SUPABASE_URL?.trim() || CANONICAL_SUPABASE_URL,
  publishableKey:
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || CANONICAL_SUPABASE_PUBLISHABLE_KEY,
});
