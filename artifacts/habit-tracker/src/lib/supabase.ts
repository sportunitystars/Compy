import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env vars — check SUPABASE_URL and SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: "habit_supabase_session",
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
