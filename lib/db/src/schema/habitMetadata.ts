import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const habitMetadata = pgTable("habit_metadata", {
  supabaseHabitId: text("supabase_habit_id").primaryKey(),
  isPrivate: boolean("is_private").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
