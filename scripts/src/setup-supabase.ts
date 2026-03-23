import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// We'll use the REST API to run SQL via the pg connection
// Instead, let's just verify the tables exist and create data
async function main() {
  console.log("Checking Supabase connection...");

  // Check if profiles table exists by trying to select from it
  const { data, error } = await supabase.from("profiles").select("id").limit(1);
  
  if (error) {
    if (error.message.includes("relation") && error.message.includes("does not exist")) {
      console.error("❌ Tables do not exist in Supabase yet.");
      console.log("\n📋 Please run this SQL in Supabase Dashboard → SQL Editor:\n");
      console.log(`
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habits (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '✨',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id serial PRIMARY KEY,
  habit_id integer NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date text NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits(user_id);
CREATE INDEX IF NOT EXISTS habit_logs_habit_id_idx ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS habit_logs_user_id_idx ON habit_logs(user_id);

-- Optional: Disable RLS (server uses service_role which bypasses it anyway)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
      `);
    } else {
      console.error("Connection error:", error.message);
    }
    process.exit(1);
  }

  console.log("✅ Supabase connection successful! Tables exist.");
  console.log(`📊 Profiles found: ${data?.length ?? 0}`);
}

main().catch(console.error);
