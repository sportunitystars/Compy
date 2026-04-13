CREATE TABLE "habit_metadata" (
	"supabase_habit_id" text PRIMARY KEY NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
